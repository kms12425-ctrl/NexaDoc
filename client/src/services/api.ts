import type {
  User,
  DocumentMeta,
  SnapshotMeta,
  DocumentAccess,
  Comment,
  DocumentAbilities,
} from '../types'

// 默认同源（空字符串 → fetch('/api/...') 走当前 origin）：
// 开发时由 Vite 代理转发到 :3001，生产时由 Express 同进程提供，无需构建期注入地址
const API_URL = import.meta.env.VITE_API_URL || ''

/* ── Token 管理 ────────────────────────────────────────────── */
const TOKEN_KEY = 'cdocs_token'

export function getToken(): string | null
{
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void
{
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void
{
  sessionStorage.removeItem(TOKEN_KEY)
}

/* ── 统一 fetch 封装 ─────────────────────────────────────────── */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T>
{
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

/* ── Auth API ────────────────────────────────────────────────── */
export interface AuthResponse
{
  token: string
  user: User
}

export const authApi = {
  register: (username: string, password: string, email?: string) =>
    apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    }),

  login: (username: string, password: string) =>
    apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
}

/* ── Documents API ───────────────────────────────────────────── */
export interface DocumentWithAbilities extends DocumentMeta
{
  abilities: DocumentAbilities
  shared?: boolean
}

export const documentsApi = {
  list: () => apiFetch<DocumentWithAbilities[]>('/api/documents'),

  create: (name: string) =>
    apiFetch<DocumentWithAbilities>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getMetadata: (docId: string) =>
    apiFetch<DocumentWithAbilities>(`/api/documents/${docId}/metadata`),

  updateMetadata: (docId: string, title: string) =>
    apiFetch<{ status: string }>(`/api/documents/${docId}/metadata`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),

  remove: (docId: string) =>
    apiFetch<{ status: string }>(`/api/documents/${docId}`, {
      method: 'DELETE',
    }),
}

/* ── Snapshots API ───────────────────────────────────────────── */
export const snapshotsApi = {
  list: (docId: string) =>
    apiFetch<SnapshotMeta[]>(`/api/documents/${docId}/snapshots`),

  create: (docId: string, name: string, preview: string, content: string) =>
    apiFetch<{ status: string; id: string }>(`/api/documents/${docId}/snapshots`, {
      method: 'POST',
      body: JSON.stringify({ name, preview, content }),
    }),

  restore: (docId: string, snapshotId: string) =>
    apiFetch<{ crdtState: number[]; contentJson: string | null }>(
      `/api/documents/${docId}/snapshots/${snapshotId}/restore`,
      { method: 'POST' }
    ),
}

/* ── Sharing API ─────────────────────────────────────────────── */
export const sharingApi = {
  listAccess: (docId: string) =>
    apiFetch<DocumentAccess[]>(`/api/documents/${docId}/access`),

  share: (docId: string, username: string, role: string) =>
    apiFetch<{ status: string }>(`/api/documents/${docId}/share`, {
      method: 'POST',
      body: JSON.stringify({ username, role }),
    }),

  removeAccess: (docId: string, userId: string) =>
    apiFetch<{ status: string }>(`/api/documents/${docId}/access/${userId}`, {
      method: 'DELETE',
    }),
}

/* ── Comments API ────────────────────────────────────────────── */
export const commentsApi = {
  list: (docId: string) =>
    apiFetch<Comment[]>(`/api/documents/${docId}/comments`),

  create: (docId: string, body: string) =>
    apiFetch<{ status: string; id: string }>(`/api/documents/${docId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  resolve: (docId: string, commentId: string) =>
    apiFetch<{ status: string }>(`/api/documents/${docId}/comments/${commentId}/resolve`, {
      method: 'PATCH',
    }),
}

/* ── WebSocket 地址（同源派生，dev/prod 通用）─────────────────── */
/** ws(s)://<当前 host> —— 开发为 :5173（Vite 代理），生产为 :3001（同进程） */
export function getWsBase(): string
{
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}`
}

/** Yjs 同步服务地址（可用 VITE_YJS_URL 显式覆盖） */
export function getYjsWsUrl(): string
{
  return import.meta.env.VITE_YJS_URL || `${getWsBase()}/yjs`
}

/* ── Notification WebSocket URL ──────────────────────────────── */
export function getNotificationWsUrl(): string
{
  const token = getToken()
  const base = getYjsWsUrl().replace(/\/yjs\/?$/, '')
  return `${base}/ws/notifications?token=${token}`
}
