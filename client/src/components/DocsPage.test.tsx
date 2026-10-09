import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import DocsPage from './DocsPage'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:3001'
const server = setupServer()

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
  // Mock WebSocket to prevent real connections in jsdom
  vi.stubGlobal('WebSocket', vi.fn(() => ({
    close: vi.fn(),
    onmessage: null,
    onerror: null,
    onopen: null,
    onclose: null,
  })))
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
})
