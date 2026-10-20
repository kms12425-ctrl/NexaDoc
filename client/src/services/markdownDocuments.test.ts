import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { documentsApi } from './api'
import { isMarkdownApiEnabled, markdownDocumentsApi } from './markdownDocuments'

const server = setupServer()
const url = 'http://localhost:3001/api/documents'
const doc = { id: 'md-1', name: 'Notes', editorType: 'markdown', createdAt: 1, updatedAt: 1, abilities: { canView: true } }

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => vi.stubEnv('VITE_MARKDOWN_API_ENABLED', 'true'))
afterEach(() => { server.resetHandlers(); vi.restoreAllMocks(); vi.unstubAllEnvs() })
afterAll(() => server.close())

describe('Markdown document API', () => {
  it('enables the integrated backend by default while preserving an explicit opt-out', () => {
    vi.stubEnv('VITE_MARKDOWN_API_ENABLED', undefined)
    expect(isMarkdownApiEnabled()).toBe(true)
    vi.stubEnv('VITE_MARKDOWN_API_ENABLED', 'false')
    expect(isMarkdownApiEnabled()).toBe(false)
  })
  it('requests the Markdown type and isolates owned, visible Markdown documents', async () => {
    let requestedType: string | null = null
    server.use(http.get(url, ({ request }) => {
      requestedType = new URL(request.url).searchParams.get('type')
      return HttpResponse.json([
        doc,
        { ...doc, id: 'newer', updatedAt: 2 },
        { ...doc, id: 'rich', editorType: 'rich' },
        { ...doc, id: 'shared', shared: true },
        { ...doc, id: 'hidden', abilities: { canView: false } },
      ])
    }))

    const result = await markdownDocumentsApi.list()

    expect(requestedType).toBe('markdown')
    expect(result.map(({ id }) => id)).toEqual(['newer', 'md-1'])
  })

  it('sends the actual template source in the creation request', async () => {
    let body: unknown
    server.use(http.post(url, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(doc, { status: 201 })
    }))

    await markdownDocumentsApi.create('Notes', '# Notes\n\n- [ ] Follow up\n')

    expect(body).toEqual({ name: 'Notes', editorType: 'markdown', markdown: '# Notes\n\n- [ ] Follow up\n', tags: [] })
  })

  it('rejects a legacy server response instead of opening a rich document as Markdown', async () => {
    server.use(http.post(url, () => HttpResponse.json({ ...doc, editorType: undefined })))

    await expect(markdownDocumentsApi.create('Notes', '# Notes')).rejects.toThrow('not supported by this server')
  })

  it('blocks all Markdown data requests while the backend integration is disabled', async () => {
    vi.stubEnv('VITE_MARKDOWN_API_ENABLED', 'false')
    const list = vi.spyOn(documentsApi, 'list')
    const create = vi.spyOn(documentsApi, 'create')
    const remove = vi.spyOn(documentsApi, 'remove')

    await expect(markdownDocumentsApi.list()).rejects.toThrow('not available yet')
    await expect(markdownDocumentsApi.create('Notes', '')).rejects.toThrow('not available yet')
    await expect(markdownDocumentsApi.remove('md-1')).rejects.toThrow('not available yet')
    expect(list).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('encodes document IDs for deletion', async () => {
    const remove = vi.spyOn(documentsApi, 'remove').mockResolvedValue({ status: 'ok' })

    await markdownDocumentsApi.remove('中文/notes')

    expect(remove).toHaveBeenCalledWith(encodeURIComponent('中文/notes'))
  })

  it('rejects an invalid list response', async () => {
    server.use(http.get(url, () => HttpResponse.json({ items: [] })))

    await expect(markdownDocumentsApi.list()).rejects.toThrow('Unable to load')
  })
})
