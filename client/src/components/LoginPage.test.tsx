import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import LoginPage from './LoginPage'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:3001'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  sessionStorage.clear()
})
afterAll(() => server.close())

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  it('renders sign-in form', () => {
    renderLoginPage()
    // h2 heading and button both say "Sign in"
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument()
  })

  it('disables submit button when inputs are empty', () => {
    renderLoginPage()
    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).toBeDisabled()
  })

  it('enables submit button when both inputs are filled', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByPlaceholderText('Enter username'), 'alice')
    await user.type(screen.getByPlaceholderText('Enter password'), 'pass123')

    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).toBeEnabled()
  })

  it('shows loading text on submit', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${API_URL}/api/auth/login`, async () => {
        await new Promise((r) => setTimeout(r, 500))
        return HttpResponse.json({
          token: 'fake-token',
          user: { id: 'u1', username: 'alice', displayName: 'alice', avatarColor: '#fff' },
        })
      })
    )

    renderLoginPage()

    await user.type(screen.getByPlaceholderText('Enter username'), 'alice')
    await user.type(screen.getByPlaceholderText('Enter password'), 'pass123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/Signing in/i)).toBeInTheDocument()
    })
  })

  it('displays error on login failure', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${API_URL}/api/auth/login`, () =>
        new HttpResponse(null, { status: 401 })
      )
    )

    renderLoginPage()

    await user.type(screen.getByPlaceholderText('Enter username'), 'alice')
    await user.type(screen.getByPlaceholderText('Enter password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/Unauthorized/i)).toBeInTheDocument()
    })
  })

  it('has a link to register page', () => {
    renderLoginPage()
    expect(screen.getByText('Create one')).toBeInTheDocument()
  })

  it('autofocuses username input', () => {
    renderLoginPage()
    const usernameInput = screen.getByPlaceholderText('Enter username')
    expect(usernameInput).toHaveFocus()
  })
})
