import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMarkdownTransport, MarkdownApiError, MarkdownConflictError } from './contentApi'

afterEach(() => vi.unstubAllGlobals())
describe('Markdown content transport', () => {
  it('loads an encoded document ID with the captured account token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ markdown: '中文', revision: 0, updatedAt: 1 })))
    vi.stubGlobal('fetch', fetcher)
    expect(await createMarkdownTransport('中文/doc', 'token-a').load()).toMatchObject({ markdown: '中文', revision: 0 })
    expect(fetcher.mock.calls[0][0]).toBe('http://localhost:3001/api/documents/' + encodeURIComponent('中文/doc') + '/markdown')
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer token-a')
  })
  it('sends baseRevision and limits keepalive to small JSON bodies', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ revision: 1, updatedAt: 2 })))
    vi.stubGlobal('fetch', fetcher)
    const api = createMarkdownTransport('doc', 'token')
    await api.save('# Small', 0, true)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'PUT', keepalive: true })
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ markdown: '# Small', baseRevision: 0 })
    await api.save('中'.repeat(30_000), 0, true)
    expect(fetcher.mock.calls[1][1].keepalive).toBe(false)
  })
  it('preserves the structured 409 response for explicit conflict resolution', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Conflict', markdown: 'Remote', revision: 2, updatedAt: 3 }), { status: 409 })))
    const result = createMarkdownTransport('doc').save('Mine', 0)
    await expect(result).rejects.toBeInstanceOf(MarkdownConflictError)
    await expect(result).rejects.toMatchObject({ current: { markdown: 'Remote', revision: 2 } })
  })
  it('handles non-JSON errors and does not mistake collaboration mode for a source conflict', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('Offline upstream', { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Collaboration enabled' }), { status: 409 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(createMarkdownTransport('doc').load()).rejects.toMatchObject({ status: 503 })
    await expect(createMarkdownTransport('doc').save('', 0)).rejects.toBeInstanceOf(MarkdownApiError)
  })
  it('rejects malformed successful payloads instead of losing the local revision', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('{}')))
    await expect(createMarkdownTransport('doc').load()).rejects.toThrow('Invalid Markdown response')
    await expect(createMarkdownTransport('doc').save('', 0)).rejects.toThrow('Invalid save response')
  })
})
