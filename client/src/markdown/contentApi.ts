import { getToken } from '../services/api'
import type { MarkdownDocumentPayload } from '../types'

const API_URL = import.meta.env.VITE_API_URL || ''

export class MarkdownApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}

export class MarkdownConflictError extends MarkdownApiError {
  constructor(public readonly current: MarkdownDocumentPayload) { super('This document changed in another window.', 409) }
}

export interface MarkdownContentTransport {
  load(signal?: AbortSignal): Promise<MarkdownDocumentPayload>
  save(markdown: string, baseRevision: number, keepalive?: boolean): Promise<{ revision: number; updatedAt: number }>
}

export function createMarkdownTransport(docId: string, token = getToken()): MarkdownContentTransport {
  const url = `${API_URL}/api/documents/${encodeURIComponent(docId)}/markdown`
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  async function read(response: Response) {
    const body = await response.json().catch(() => ({}))
    if (response.status === 409 && typeof body.markdown === 'string' && Number.isSafeInteger(body.revision) && body.revision >= 0 && typeof body.updatedAt === 'number') {
      throw new MarkdownConflictError(body)
    }
    if (!response.ok) throw new MarkdownApiError(body.error || `HTTP ${response.status}`, response.status)
    return body
  }
  return {
    async load(signal) {
      const body = await read(await fetch(url, { headers, signal }))
      if (typeof body.markdown !== 'string' || !Number.isSafeInteger(body.revision) || body.revision < 0 || typeof body.updatedAt !== 'number') {
        throw new MarkdownApiError('Invalid Markdown response.', 502)
      }
      return body
    },
    async save(markdown, baseRevision, keepalive = false) {
      const body = JSON.stringify({ markdown, baseRevision })
      const result = await read(await fetch(url, {
        method: 'PUT', headers, body,
        // Browser keepalive bodies have a shared ~64 KiB budget. Large drafts stay local on exit.
        keepalive: keepalive && new TextEncoder().encode(body).byteLength < 60_000,
      }))
      if (!Number.isSafeInteger(result.revision) || result.revision <= baseRevision || typeof result.updatedAt !== 'number') {
        throw new MarkdownApiError('Invalid save response.', 502)
      }
      return result
    },
  }
}
