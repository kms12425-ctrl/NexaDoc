import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { AuthProvider } from '../../contexts/AuthContext'
import { markdownTemplates } from '../../templates/markdown'
import { documentsApi } from '../../services/api'
import MarkdownHome from './MarkdownHome'

const url = 'http://localhost:3001/api/documents'
const tagsUrl = 'http://localhost:3001/api/tags'
const server = setupServer()
const document = {
  id: 'md-project', name: 'Project Plan', editorType: 'markdown', createdAt: 1, updatedAt: 2,
  tags: ['项目'], abilities: { canView: true, canDelete: true },
}

function Location() {
  const location = useLocation()
  return <output aria-label="Current location">{location.pathname + location.search}</output>
}

function EditorDestination() {
  const { id } = useParams()
  return <h1>Opened {id}</h1>
}

function renderHome(path = '/markdown') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><Routes>
    <Route path="/markdown" element={<MarkdownHome />} />
    <Route path="/markdown/:id" element={<EditorDestination />} />
  </Routes><Location /></AuthProvider></MemoryRouter>)
}

async function chooseBlank() {
  await userEvent.click(screen.getByRole('button', { name: 'Blank Markdown' }))
  return screen.getByRole('textbox', { name: 'Document name' })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  vi.stubEnv('VITE_MARKDOWN_API_ENABLED', 'true')
  sessionStorage.setItem('cdocs_token', `e30.${btoa(JSON.stringify({ id: 'u1', username: 'alice', exp: Date.now() / 1000 + 3600 }))}.signature`)
  server.use(http.get(url, () => HttpResponse.json([])))
  server.use(http.get(tagsUrl, () => HttpResponse.json([])))
})
afterEach(() => { server.resetHandlers(); vi.restoreAllMocks(); vi.unstubAllEnvs() })
afterAll(() => server.close())

describe('MarkdownHome', () => {
  it('renders the shared home layout and isolates owned Markdown documents', async () => {
    server.use(http.get(url, () => HttpResponse.json([
      document,
      { ...document, id: 'shared', name: 'Shared Notes', shared: true },
      { ...document, id: 'rich', name: 'Rich Notes', editorType: 'rich' },
    ])))
    renderHome()

    const card = await screen.findByRole('article', { name: 'Open document: Project Plan' })
    expect(screen.getByRole('heading', { name: 'Start a new document' })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Template categories' })).getAllByRole('button')).toHaveLength(5)
    expect(within(card).getByText('#项目')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Open document: Shared Notes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Open document: Rich Notes' })).not.toBeInTheDocument()
    expect(screen.queryByText('Shared with me')).not.toBeInTheDocument()
  })

  it('switches gallery categories and selects the corresponding template', async () => {
    const user = userEvent.setup()
    renderHome()
    const categories = screen.getByRole('group', { name: 'Template categories' })
    await user.click(within(categories).getByRole('button', { name: 'Business' }))

    expect(screen.getByRole('button', { name: 'Meeting Notes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weekly Report' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Meeting Notes' }))
    expect(screen.getByRole('textbox', { name: 'Document name' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Document name' })).toHaveAttribute('placeholder', 'Meeting Notes')
  })

  it('opens all seven templates from New document and restores focus after cancellation', async () => {
    const user = userEvent.setup()
    renderHome()
    const trigger = screen.getByRole('button', { name: 'New document' })
    await user.click(trigger)
    const picker = screen.getByRole('dialog', { name: 'Choose a Markdown template' })
    expect(picker.querySelectorAll('.template-card')).toHaveLength(7)
    await user.click(within(picker).getByRole('button', { name: 'Personal' }))
    expect(picker.querySelectorAll('.template-card')).toHaveLength(2)
    await user.click(within(picker).getByRole('button', { name: /Reading Notes/ }))
    expect(screen.getByRole('textbox', { name: 'Document name' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Document name' })).toHaveAttribute('placeholder', 'Reading Notes')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('submits the selected source and a trimmed custom name, then opens the Markdown route', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(http.post(url, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...document, id: 'created' }, { status: 201 })
    }))
    renderHome()
    await user.click(within(screen.getByRole('group', { name: 'Template categories' })).getByRole('button', { name: 'Business' }))
    await user.click(screen.getByRole('button', { name: 'Meeting Notes' }))
    const input = screen.getByRole('textbox', { name: 'Document name' })
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('placeholder', 'Meeting Notes')
    await user.type(input, '  项目会议  {Enter}')

    expect(await screen.findByRole('heading', { name: 'Opened created' })).toBeInTheDocument()
    expect(body).toEqual({ name: '项目会议', editorType: 'markdown', markdown: markdownTemplates.find(({ id }) => id === 'md-meeting-notes')!.markdown, tags: [] })
  })

  it('creates an empty blank document using its default name', async () => {
    let body: unknown
    server.use(http.post(url, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...document, id: 'blank' }, { status: 201 })
    }))
    renderHome()
    await chooseBlank()
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('heading', { name: 'Opened blank' })).toBeInTheDocument()
    expect(body).toEqual({ name: 'Untitled document', editorType: 'markdown', markdown: '', tags: [] })
  })

  it('creates a nonblank template with its default name when the placeholder is left untouched', async () => {
    let body: unknown
    server.use(http.post(url, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...document, id: 'default-template' }, { status: 201 })
    }))
    renderHome()
    await userEvent.click(within(screen.getByRole('group', { name: 'Template categories' })).getByRole('button', { name: 'Business' }))
    await userEvent.click(screen.getByRole('button', { name: 'Meeting Notes' }))
    const input = screen.getByRole('textbox', { name: 'Document name' })
    expect(input).toHaveFocus()
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('placeholder', 'Meeting Notes')
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Opened default-template' })).toBeInTheDocument()
    expect(body).toEqual({ name: 'Meeting Notes', editorType: 'markdown', markdown: markdownTemplates.find(({ id }) => id === 'md-meeting-notes')!.markdown, tags: [] })
  })

  it('preserves the name and template on failure and allows creation to be retried', async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    server.use(http.post(url, async ({ request }) => {
      bodies.push(await request.json())
      return bodies.length === 1
        ? HttpResponse.json({ error: 'Please try again' }, { status: 503 })
        : HttpResponse.json({ ...document, id: 'retried' }, { status: 201 })
    }))
    renderHome()
    const input = await chooseBlank()
    await user.type(input, 'Keep my name')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again')
    expect(input).toHaveValue('Keep my name')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('heading', { name: 'Opened retried' })).toBeInTheDocument()
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toEqual(bodies[0])
  })

  it('prevents repeated creation while a request is in flight', async () => {
    const user = userEvent.setup()
    let finish!: () => void
    const gate = new Promise<void>((resolve) => { finish = resolve })
    let requests = 0
    server.use(http.post(url, async () => {
      requests++
      await gate
      return HttpResponse.json({ ...document, id: 'once' }, { status: 201 })
    }))
    renderHome()
    const input = await chooseBlank()
    await user.dblClick(screen.getByRole('button', { name: 'Create' }))
    try {
      await waitFor(() => expect(requests).toBe(1))
      expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
      expect(input).toHaveAttribute('readonly')
      await user.click(input)
      await user.keyboard('{Enter}{Escape}')
      expect(screen.getByRole('dialog', { name: 'Name your document' })).toBeInTheDocument()
      expect(requests).toBe(1)
    } finally { finish() }
    expect(await screen.findByRole('heading', { name: 'Opened once' })).toBeInTheDocument()
  })

  it('waits for deletion confirmation, preserves failed deletions, and supports retry', async () => {
    const user = userEvent.setup()
    let requests = 0
    server.use(
      http.get(url, () => HttpResponse.json([document])),
      http.delete(`${url}/md-project`, () => ++requests === 1
        ? HttpResponse.json({ error: 'Delete failed' }, { status: 500 })
        : HttpResponse.json({ status: 'ok' })),
    )
    renderHome()
    const remove = await screen.findByRole('button', { name: 'Delete Project Plan' })
    await user.click(remove)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(requests).toBe(0)
    await user.click(remove)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed')
    expect(screen.getByRole('article', { name: 'Open document: Project Plan' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument())
    expect(screen.getByText('No documents yet')).toBeInTheDocument()
    expect(requests).toBe(2)
  })

  it('keeps templates available while loading documents', async () => {
    let finish!: () => void
    const gate = new Promise<void>((resolve) => { finish = resolve })
    server.use(http.get(url, async () => { await gate; return HttpResponse.json([document]) }))
    renderHome()
    try {
      expect(screen.getByText('Loading Markdown documents…')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Blank Markdown' })).toBeInTheDocument()
    } finally { finish() }
    expect(await screen.findByRole('article')).toBeInTheDocument()
  })

  it('shows a list error and allows retry without removing the template gallery', async () => {
    const user = userEvent.setup()
    let attempts = 0
    server.use(http.get(url, () => ++attempts === 1
      ? HttpResponse.json({ error: 'List unavailable' }, { status: 503 })
      : HttpResponse.json([])))
    renderHome()
    expect(await screen.findByRole('alert')).toHaveTextContent('List unavailable')
    expect(screen.getByRole('button', { name: 'Blank Markdown' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('No documents yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('filters titles using URL state and clears the filter with Escape', async () => {
    const user = userEvent.setup()
    server.use(http.get(url, () => HttpResponse.json([document, { ...document, id: 'md-cn', name: '会议纪要' }])))
    renderHome('/markdown?q=project')
    expect(await screen.findByRole('article', { name: 'Open document: Project Plan' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Open document: 会议纪要' })).not.toBeInTheDocument()
    const search = screen.getByRole('searchbox', { name: 'Search Markdown' })
    await user.clear(search)
    await user.type(search, '会议')
    expect(screen.getByRole('article', { name: 'Open document: 会议纪要' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Open document: Project Plan' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByLabelText('Current location')).toHaveTextContent('/markdown')
    expect(search).toHaveValue('')
  })

  it('allows template browsing but makes no data requests while integration is disabled', async () => {
    vi.stubEnv('VITE_MARKDOWN_API_ENABLED', 'false')
    const list = vi.spyOn(documentsApi, 'list')
    const create = vi.spyOn(documentsApi, 'create')
    renderHome()
    await chooseBlank()

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('not available yet')
    expect(list).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('does not navigate when an incompatible server creates a rich document', async () => {
    server.use(http.post(url, () => HttpResponse.json({ ...document, editorType: undefined })))
    renderHome()
    await chooseBlank()
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('not supported by this server')
    expect(screen.getByLabelText('Current location')).toHaveTextContent('/markdown')
    expect(screen.getByRole('dialog', { name: 'Name your document' })).toBeInTheDocument()
  })
})
