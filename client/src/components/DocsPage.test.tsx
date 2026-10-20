import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import DocsPage from './DocsPage'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { templatesByCategory } from '../templates'

const API_URL = 'http://localhost:3001'
const server = setupServer()

// This suite exercises document HTTP flows; notification sockets are unrelated.
vi.mock('../services/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/api')>(),
  getNotificationWsUrl: () => '',
}))

function makeJwtToken(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

function setupAuth() {
  const token = makeJwtToken({
    id: 'u1', username: 'alice', avatarColor: '#4285f4',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })
  sessionStorage.setItem('cdocs_token', token)
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' })
})
beforeEach(() => {
  setupAuth()
})
afterEach(() => {
  server.resetHandlers()
  sessionStorage.clear()
})
afterAll(() => server.close())

function renderDocsPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DocsPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('DocsPage', () => {
  it('keeps legacy rich documents visible and excludes Markdown documents', async () => {
    let type: string | null = null
    server.use(http.get(`${API_URL}/api/documents`, ({ request }) => {
      type = new URL(request.url).searchParams.get('type')
      return HttpResponse.json([
      { id: 'legacy', name: 'Legacy Notes', createdAt: 1, updatedAt: 1, shared: false },
      { id: 'md', name: 'Markdown Notes', editorType: 'markdown', createdAt: 1, updatedAt: 1, shared: false },
    ]) }))
    renderDocsPage()

    expect(await screen.findByRole('article', { name: 'Open document: Legacy Notes' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Open document: Markdown Notes' })).not.toBeInTheDocument()
    expect(type).toBe('rich')
  })

  it('keeps owned and shared cards distinct after extracting the shared component', async () => {
    server.use(http.get(`${API_URL}/api/documents`, () => HttpResponse.json([
      { id: 'owned', name: 'My Notes', createdAt: 1, updatedAt: 1, shared: false },
      { id: 'shared', name: 'Team Notes', createdAt: 1, updatedAt: 1, shared: true },
    ])))
    renderDocsPage()

    const owned = await screen.findByRole('article', { name: 'Open document: My Notes' })
    const shared = screen.getByRole('article', { name: 'Open document: Team Notes' })
    expect(within(owned).getByRole('button', { name: 'Delete My Notes' })).toBeInTheDocument()
    expect(within(shared).queryByRole('button')).not.toBeInTheDocument()
    expect(shared).toHaveClass('shared-card')
  })

  it('opens deletion confirmation from the keyboard and removes only after confirming', async () => {
    const user = userEvent.setup()
    const remove = vi.fn()
    server.use(
      http.get(`${API_URL}/api/documents`, () => HttpResponse.json([
        { id: 'owned', name: 'My Notes', createdAt: 1, updatedAt: 1, shared: false },
      ])),
      http.delete(`${API_URL}/api/documents/owned`, () => {
        remove()
        return HttpResponse.json({ status: 'ok' })
      })
    )
    renderDocsPage()
    const deleteButton = await screen.findByRole('button', { name: 'Delete My Notes' })
    deleteButton.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('dialog', { name: 'Confirm delete' })).toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument())
    expect(remove).toHaveBeenCalledOnce()
  })

  it('renders document list', async () => {
    server.use(
      http.get(`${API_URL}/api/documents`, () =>
        HttpResponse.json([
          { id: 'd1', name: 'Doc One', createdAt: 1, updatedAt: 1, abilities: {}, shared: false },
          { id: 'd2', name: 'Doc Two', createdAt: 2, updatedAt: 2, abilities: {}, shared: false },
          { id: 'd3', name: 'Doc Three', createdAt: 3, updatedAt: 3, abilities: {}, shared: false },
        ])
      )
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Doc One')).toBeInTheDocument()
      expect(screen.getByText('Doc Two')).toBeInTheDocument()
      expect(screen.getByText('Doc Three')).toBeInTheDocument()
    })
  })

  it('shows error on load failure', async () => {
    server.use(
      http.get(`${API_URL}/api/documents`, () =>
        HttpResponse.json({ error: 'Database down' }, { status: 500 })
      )
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText(/Database down/i)).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    server.use(
      http.get(`${API_URL}/api/documents`, () =>
        HttpResponse.json([])
      )
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    })
  })

  it('filters documents by search query', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_URL}/api/documents`, () =>
        HttpResponse.json([
          { id: 'd1', name: 'Alpha Doc', createdAt: 1, updatedAt: 1, abilities: {}, shared: false },
          { id: 'd2', name: 'Beta Doc', createdAt: 2, updatedAt: 2, abilities: {}, shared: false },
        ])
      )
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Alpha Doc')).toBeInTheDocument()
      expect(screen.getByText('Beta Doc')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/search/i), 'Alpha')

    expect(screen.getByText('Alpha Doc')).toBeInTheDocument()
    expect(screen.queryByText('Beta Doc')).not.toBeInTheDocument()
  })

  it('renders new document button', async () => {
    server.use(
      http.get(`${API_URL}/api/documents`, () =>
        HttpResponse.json([])
      )
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText(/new/i)).toBeInTheDocument()
    })
  })

  /* ── Template gallery tests ────────────────────────────────── */

  it('shows category tabs in Start a new document', async () => {
    server.use(
      http.get(`${API_URL}/api/documents`, () => HttpResponse.json([]))
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Start a new document')).toBeInTheDocument()
    })

    // Category tabs are inside .start-categories
    const catContainer = document.querySelector('.start-categories')
    expect(catContainer).toBeTruthy()
    for (const label of ['Blank', 'Business', 'Personal', 'Education', 'Creative']) {
      expect(within(catContainer as HTMLElement).getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(catContainer?.querySelectorAll('button')).toHaveLength(5)
  })

  it('shows blank template by default in start section', async () => {
    server.use(
      http.get(`${API_URL}/api/documents`, () => HttpResponse.json([]))
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Start a new document')).toBeInTheDocument()
    })

    // Blank category has only 1 template — the card with title "Start from scratch"
    expect(screen.getByTitle('Start from scratch')).toBeInTheDocument()
  })

  it('switches templates when clicking Business category tab', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_URL}/api/documents`, () => HttpResponse.json([]))
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Start a new document')).toBeInTheDocument()
    })

    // Click Business tab inside start-categories
    const catContainer = document.querySelector('.start-categories')
    const businessTab = Array.from(catContainer!.querySelectorAll('button'))
      .find(btn => btn.textContent === 'Business')!
    await user.click(businessTab)

    // Business templates should appear as cards in the scroll row
    const scrollRow = document.querySelector('.template-row-scroll')
    const cardNames = Array.from(scrollRow!.querySelectorAll('.template-start-card > span'))
      .map(el => el.textContent)
    for (const tpl of templatesByCategory.business) {
      expect(cardNames).toContain(tpl.name)
    }
  })

  it('opens naming modal when a template is clicked', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_URL}/api/documents`, () => HttpResponse.json([]))
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Start a new document')).toBeInTheDocument()
    })

    // Click the Blank template card
    const blankCard = screen.getByTitle('Start from scratch')
    await user.click(blankCard)

    // Naming modal should appear
    expect(screen.getByText('Name your document')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Untitled document')).toBeInTheDocument()
  })

  it('creates document with template name when name left empty', async () => {
    const user = userEvent.setup()
    const createdDocs: { name: string }[] = []
    server.use(
      http.get(`${API_URL}/api/documents`, () => HttpResponse.json([])),
      http.post(`${API_URL}/api/documents`, async ({ request }) => {
        const body = await request.json() as { name: string }
        createdDocs.push(body)
        return HttpResponse.json({
          id: 'new-1', name: body.name, createdAt: 1, updatedAt: 1, abilities: {}, shared: false,
        })
      })
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Start a new document')).toBeInTheDocument()
    })

    // Switch to Business and click Meeting Notes template
    const catContainer = document.querySelector('.start-categories')
    const businessTab = Array.from(catContainer!.querySelectorAll('button'))
      .find(btn => btn.textContent === 'Business')!
    await user.click(businessTab)

    // Click the Meeting Notes template card by its title
    const meetingCard = screen.getByTitle('Agenda, attendees, decisions, and action items')
    await user.click(meetingCard)

    // Click Create without typing a name
    const createBtn = screen.getByRole('button', { name: 'Create' })
    await user.click(createBtn)

    await waitFor(() => {
      expect(createdDocs).toHaveLength(1)
    })
    expect(createdDocs[0].name).toBe('Meeting Notes')
  })

  it('creates document with custom name when user types one', async () => {
    const user = userEvent.setup()
    const createdDocs: { name: string }[] = []
    server.use(
      http.get(`${API_URL}/api/documents`, () => HttpResponse.json([])),
      http.post(`${API_URL}/api/documents`, async ({ request }) => {
        const body = await request.json() as { name: string }
        createdDocs.push(body)
        return HttpResponse.json({
          id: 'new-2', name: body.name, createdAt: 1, updatedAt: 1, abilities: {}, shared: false,
        })
      })
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Start a new document')).toBeInTheDocument()
    })

    // Click Blank template card
    await user.click(screen.getByTitle('Start from scratch'))

    // Type a custom name
    const input = screen.getByPlaceholderText('Untitled document')
    await user.type(input, 'My Custom Doc')

    const createBtn = screen.getByRole('button', { name: 'Create' })
    await user.click(createBtn)

    await waitFor(() => {
      expect(createdDocs).toHaveLength(1)
    })
    expect(createdDocs[0].name).toBe('My Custom Doc')
  })

  it('closes naming modal on Cancel', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_URL}/api/documents`, () => HttpResponse.json([]))
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Start a new document')).toBeInTheDocument()
    })

    await user.click(screen.getByTitle('Start from scratch'))
    expect(screen.getByText('Name your document')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByText('Name your document')).not.toBeInTheDocument()
    })
  })

  it('opens template picker modal when New document button is clicked', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_URL}/api/documents`, () => HttpResponse.json([]))
    )

    renderDocsPage()

    await waitFor(() => {
      expect(screen.getByText('Start a new document')).toBeInTheDocument()
    })

    await user.click(screen.getByText('New document'))

    // TemplatePicker modal should appear
    expect(screen.getByText('Choose a template')).toBeInTheDocument()
  })
})
