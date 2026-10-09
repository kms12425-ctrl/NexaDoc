import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:3001'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
beforeEach(() => {
  sessionStorage.clear()
})
afterEach(() => {
  server.resetHandlers()
  sessionStorage.clear()
})
afterAll(() => server.close())

// 创建一个合法的 JWT token（用 btoa 模拟）
function makeJwtToken(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('AuthProvider', () => {
  it('starts with loading=true, then loading=false and user=null when no token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    // useEffect 同步执行后 loading 变为 false
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.user).toBeNull()
  })

  it('restores user from valid token', async () => {
    const token = makeJwtToken({
      id: 'user-123',
      username: 'alice',
      avatarColor: '#4285f4',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1h from now
    })
    sessionStorage.setItem('cdocs_token', token)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.user).not.toBeNull()
    expect(result.current.user?.id).toBe('user-123')
    expect(result.current.user?.username).toBe('alice')
  })

  it('clears expired token', async () => {
    const expiredToken = makeJwtToken({
      id: 'user-123',
      username: 'alice',
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1h ago
    })
    sessionStorage.setItem('cdocs_token', expiredToken)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.user).toBeNull()
    expect(sessionStorage.getItem('cdocs_token')).toBeNull()
  })

  it('clears invalid token', async () => {
    sessionStorage.setItem('cdocs_token', 'garbage.token.here')

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.user).toBeNull()
    expect(sessionStorage.getItem('cdocs_token')).toBeNull()
  })

  it('login sets user and token', async () => {
    server.use(
      http.post(`${API_URL}/api/auth/login`, () =>
        HttpResponse.json({
          token: makeJwtToken({ id: 'u1', username: 'alice', exp: Date.now() + 99999 }),
          user: { id: 'u1', username: 'alice', displayName: 'alice', avatarColor: '#4285f4' },
        })
      )
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.login('alice', 'pass123')
    })

    expect(result.current.user).not.toBeNull()
    expect(result.current.user?.username).toBe('alice')
    expect(sessionStorage.getItem('cdocs_token')).not.toBeNull()
  })

  it('login error sets error and rethrows', async () => {
    server.use(
      http.post(`${API_URL}/api/auth/login`, () =>
        new HttpResponse(null, { status: 401 })
      )
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      act(async () => {
        await result.current.login('alice', 'wrong')
      })
    ).rejects.toThrow()

    expect(result.current.user).toBeNull()
  })

  it('register sets user and token', async () => {
    server.use(
      http.post(`${API_URL}/api/auth/register`, () =>
        HttpResponse.json({
          token: makeJwtToken({ id: 'u2', username: 'bob', exp: Date.now() + 99999 }),
          user: { id: 'u2', username: 'bob', displayName: 'bob', avatarColor: '#ea4335' },
        })
      )
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.register('bob', 'pass123')
    })

    expect(result.current.user?.username).toBe('bob')
    expect(sessionStorage.getItem('cdocs_token')).not.toBeNull()
  })

  it('logout clears user and token', async () => {
    const token = makeJwtToken({
      id: 'u1', username: 'alice',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    sessionStorage.setItem('cdocs_token', token)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).not.toBeNull()

    act(() => {
      result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(sessionStorage.getItem('cdocs_token')).toBeNull()
  })
})

describe('useAuth outside provider', () => {
  it('throws error when used without AuthProvider', () => {
    // 抑制 console.error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider')
    spy.mockRestore()
  })
})
