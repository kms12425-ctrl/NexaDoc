import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import RegisterPage from './RegisterPage'
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

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('RegisterPage', () => {
  it('renders sign-up form', () => {
    renderRegisterPage()
    expect(screen.getByText('Sign up')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Choose a username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('At least 6 characters')).toBeInTheDocument()
  })

  it('disables submit button when inputs are empty', () => {
    renderRegisterPage()
    const button = screen.getByRole('button', { name: /sign up/i })
    expect(button).toBeDisabled()
  })

  it('enables submit when username and password are filled', async () => {
    const user = userEvent.setup()
    renderRegisterPage()

    await user.type(screen.getByPlaceholderText('Choose a username'), 'newuser')
    await user.type(screen.getByPlaceholderText('At least 6 characters'), 'pass123')

    expect(screen.getByRole('button', { name: /sign up/i })).toBeEnabled()
  })

  it('shows loading text on submit', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${API_URL}/api/auth/register`, async () => {
        await new Promise((r) => setTimeout(r, 500))
        return HttpResponse.json({
          token: 'fake-token',
          user: { id: 'u1', username: 'newuser', displayName: 'newuser', avatarColor: '#fff' },
        })
      })
    )

    renderRegisterPage()

    await user.type(screen.getByPlaceholderText('Choose a username'), 'newuser')
    await user.type(screen.getByPlaceholderText('At least 6 characters'), 'pass123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(screen.getByText(/Creating account/i)).toBeInTheDocument()
    })
  })

  it('displays error on registration failure', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${API_URL}/api/auth/register`, () =>
        HttpResponse.json({ error: 'Username already exists' }, { status: 409 })
      )
    )

    renderRegisterPage()

    await user.type(screen.getByPlaceholderText('Choose a username'), 'dup')
    await user.type(screen.getByPlaceholderText('At least 6 characters'), 'pass123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(screen.getByText(/Username already exists/i)).toBeInTheDocument()
    })
  })

  it('has a link to sign in page', () => {
    renderRegisterPage()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('autofocuses username input', () => {
    renderRegisterPage()
    expect(screen.getByPlaceholderText('Choose a username')).toHaveFocus()
  })
})
