import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import {
  getToken,
  setToken,
  clearToken,
  authApi,
  documentsApi,
  snapshotsApi,
  sharingApi,
  commentsApi,
  getNotificationWsUrl,
} from './api'

const API_URL = 'http://localhost:3001'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  sessionStorage.clear()
})
afterAll(() => server.close())

// ── Token 管理 ──────────────────────────────────────────────────
describe('Token management', () => {
  beforeEach(() => sessionStorage.clear())

  it('getToken returns null when not set', () => {
    expect(getToken()).toBeNull()
  })

  it('setToken/getToken round-trip', () => {
    setToken('my-token')
    expect(getToken()).toBe('my-token')
  })

  it('clearToken removes token', () => {
    setToken('my-token')
    clearToken()
    expect(getToken()).toBeNull()
  })
})

// ── apiFetch 封装 ───────────────────────────────────────────────
describe('apiFetch', () => {
  it('sends Authorization header when token is set', async () => {
    setToken('bearer-token')
    let receivedAuth: string | null = null
    server.use(
      http.get(`${API_URL}/api/documents`, ({ request }) => {
        receivedAuth = request.headers.get('authorization')
        return HttpResponse.json([])
      })
    )
    await documentsApi.list()
    expect(receivedAuth).toBe('Bearer bearer-token')
  })

  it('clears token on 401', async () => {
    setToken('will-expire')
    server.use(
      http.get(`${API_URL}/api/documents`, () =>
        new HttpResponse(null, { status: 401 })
      )
    )
    await expect(documentsApi.list()).rejects.toThrow('Unauthorized')
    expect(getToken()).toBeNull()
  })

  it('throws error message from response body', async () => {
    server.use(
      http.get(`${API_URL}/api/documents`, () =>
        HttpResponse.json({ error: 'Something broke' }, { status: 500 })
      )
    )
    await expect(documentsApi.list()).rejects.toThrow('Something broke')
  })

  it('throws HTTP status when no error field', async () => {
    server.use(
      http.get(`${API_URL}/api/documents`, () =>
        new HttpResponse(null, { status: 500 })
      )
    )
    // 响应体为 null，res.json() 会失败，回退到 res.statusText
    await expect(documentsApi.list()).rejects.toThrow(/Internal Server Error|HTTP 500/)
  })
})

// ── authApi ─────────────────────────────────────────────────────
describe('authApi', () => {
  it('register sends correct body', async () => {
    let receivedBody: any
    server.use(
      http.post(`${API_URL}/api/auth/register`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({
          token: 'reg-token',
          user: { id: 'u1', username: 'alice', displayName: 'alice', avatarColor: '#fff' },
        })
      })
    )
    const res = await authApi.register('alice', 'pass123', 'a@b.com')
    expect(receivedBody.username).toBe('alice')
    expect(receivedBody.password).toBe('pass123')
    expect(receivedBody.email).toBe('a@b.com')
    expect(res.token).toBe('reg-token')
  })

  it('login sends correct body', async () => {
    let receivedBody: any
    server.use(
      http.post(`${API_URL}/api/auth/login`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({
          token: 'login-token',
          user: { id: 'u1', username: 'alice', displayName: 'alice', avatarColor: '#fff' },
        })
      })
    )
    const res = await authApi.login('alice', 'pass123')
    expect(receivedBody.username).toBe('alice')
    expect(receivedBody.password).toBe('pass123')
    expect(res.token).toBe('login-token')
  })
})

// ── documentsApi ────────────────────────────────────────────────
describe('documentsApi', () => {
  it('list returns array', async () => {
    server.use(
      http.get(`${API_URL}/api/documents`, () =>
        HttpResponse.json([
          { id: 'd1', name: 'Doc 1', createdAt: 1, updatedAt: 2, abilities: {} },
        ])
      )
    )
    const res = await documentsApi.list()
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe('d1')
  })

  it('create sends name in body', async () => {
    let receivedBody: any
    server.use(
      http.post(`${API_URL}/api/documents`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({
          id: 'new-doc', name: 'New', createdAt: 1, updatedAt: 1, abilities: {},
        })
      })
    )
    await documentsApi.create('New')
    expect(receivedBody.name).toBe('New')
  })

  it('getMetadata uses correct path', async () => {
    server.use(
      http.get(`${API_URL}/api/documents/abc/metadata`, () =>
        HttpResponse.json({ id: 'abc', name: 'Doc', createdAt: 1, updatedAt: 1, abilities: {} })
      )
    )
    const res = await documentsApi.getMetadata('abc')
    expect(res.id).toBe('abc')
  })

  it('updateMetadata sends PATCH with title', async () => {
    let receivedBody: any
    server.use(
      http.patch(`${API_URL}/api/documents/abc/metadata`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({ status: 'ok' })
      })
    )
    await documentsApi.updateMetadata('abc', 'New Title')
    expect(receivedBody.title).toBe('New Title')
  })

  it('remove sends DELETE', async () => {
    let method: string
    server.use(
      http.delete(`${API_URL}/api/documents/abc`, () => {
        method = 'DELETE'
        return HttpResponse.json({ status: 'ok' })
      })
    )
    await documentsApi.remove('abc')
    expect(method!).toBe('DELETE')
  })
})

// ── snapshotsApi ────────────────────────────────────────────────
describe('snapshotsApi', () => {
  it('list fetches snapshots', async () => {
    server.use(
      http.get(`${API_URL}/api/documents/abc/snapshots`, () =>
        HttpResponse.json([{ _id: 's1', name: 'v1', authorName: 'alice', preview: '...', createdAt: 1 }])
      )
    )
    const res = await snapshotsApi.list('abc')
    expect(res).toHaveLength(1)
  })

  it('create sends name, preview, content', async () => {
    let receivedBody: any
    server.use(
      http.post(`${API_URL}/api/documents/abc/snapshots`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({ status: 'ok', id: 's1' })
      })
    )
    await snapshotsApi.create('abc', 'v1', 'preview', '{"doc":true}')
    expect(receivedBody.name).toBe('v1')
    expect(receivedBody.preview).toBe('preview')
    expect(receivedBody.content).toBe('{"doc":true}')
  })

  it('restore sends POST and returns crdtState', async () => {
    server.use(
      http.post(`${API_URL}/api/documents/abc/snapshots/s1/restore`, () =>
        HttpResponse.json({ crdtState: [1, 2, 3], contentJson: '{"doc":true}' })
      )
    )
    const res = await snapshotsApi.restore('abc', 's1')
    expect(res.crdtState).toEqual([1, 2, 3])
    expect(res.contentJson).toBe('{"doc":true}')
  })
})

// ── sharingApi ──────────────────────────────────────────────────
describe('sharingApi', () => {
  it('listAccess fetches access list', async () => {
    server.use(
      http.get(`${API_URL}/api/documents/abc/access`, () =>
        HttpResponse.json([{ userId: 'u1', username: 'alice', role: 'owner' }])
      )
    )
    const res = await sharingApi.listAccess('abc')
    expect(res[0].username).toBe('alice')
  })

  it('share sends username and role', async () => {
    let receivedBody: any
    server.use(
      http.post(`${API_URL}/api/documents/abc/share`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({ status: 'ok' })
      })
    )
    await sharingApi.share('abc', 'bob', 'reader')
    expect(receivedBody.username).toBe('bob')
    expect(receivedBody.role).toBe('reader')
  })

  it('removeAccess sends DELETE', async () => {
    server.use(
      http.delete(`${API_URL}/api/documents/abc/access/u1`, () =>
        HttpResponse.json({ status: 'ok' })
      )
    )
    await expect(sharingApi.removeAccess('abc', 'u1')).resolves.toEqual({ status: 'ok' })
  })
})

// ── commentsApi ─────────────────────────────────────────────────
describe('commentsApi', () => {
  it('list fetches comments', async () => {
    server.use(
      http.get(`${API_URL}/api/documents/abc/comments`, () =>
        HttpResponse.json([{
          _id: 'c1', documentId: 'abc', userId: 'u1', authorName: 'alice',
          body: 'hi', resolved: false, createdAt: 1, updatedAt: 1,
        }])
      )
    )
    const res = await commentsApi.list('abc')
    expect(res[0].body).toBe('hi')
  })

  it('create sends body', async () => {
    let receivedBody: any
    server.use(
      http.post(`${API_URL}/api/documents/abc/comments`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({ status: 'ok', id: 'c1' })
      })
    )
    await commentsApi.create('abc', 'Hello world')
    expect(receivedBody.body).toBe('Hello world')
  })

  it('resolve sends PATCH', async () => {
    server.use(
      http.patch(`${API_URL}/api/documents/abc/comments/c1/resolve`, () =>
        HttpResponse.json({ status: 'ok' })
      )
    )
    await expect(commentsApi.resolve('abc', 'c1')).resolves.toEqual({ status: 'ok' })
  })
})

// ── getNotificationWsUrl ────────────────────────────────────────
describe('getNotificationWsUrl', () => {
  it('returns URL with token parameter', () => {
    setToken('my-jwt-token')
    const url = getNotificationWsUrl()
    expect(url).toContain('token=my-jwt-token')
    expect(url).toContain('/ws/notifications')
  })
})
