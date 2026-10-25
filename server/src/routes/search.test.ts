import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createTestApp, registerUser } from './test-helpers'

const app = createTestApp()
let owner: Awaited<ReturnType<typeof registerUser>>

beforeEach(async () => { owner = await registerUser(app, 'search-owner') })

function createDoc(token: string, name: string, markdown: string, tags: string[] = []) {
  return request(app).post('/api/documents').set('Authorization', `Bearer ${token}`).send({ name, editorType: 'markdown', markdown, tags })
}
function search(query: string, token = owner.token) {
  return request(app).get(`/api/search${query}`).set('Authorization', `Bearer ${token}`)
}

describe('A7 full-text search', () => {
  it('returns only the current user’s Markdown documents', async () => {
    const other = await registerUser(app, 'search-other')
    await createDoc(owner.token, '会议纪要', '# 会议纪要\n讨论进度', ['笔记'])
    await createDoc(other.token, '别人的会议', '# secret')
    await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Rich doc' })
    const res = await search('?q=会议')
    expect(res.status).toBe(200)
    expect(res.body.map((d: { name: string }) => d.name)).toEqual(['会议纪要'])
  })

  it('matches Chinese keywords in title and body', async () => {
    await createDoc(owner.token, '项目计划', '# 里程碑\n本周完成测试')
    const res = await search('?q=里程碑')
    expect(res.body.map((d: { name: string }) => d.name)).toEqual(['项目计划'])
    expect((await search('?q=测试')).body).toHaveLength(1)
  })

  it('matches English keywords case-insensitively', async () => {
    await createDoc(owner.token, 'Guide', '# Yjs guide\nlearn Yjs')
    const res = await search('?q=yjs')
    expect(res.body.map((d: { name: string }) => d.name)).toEqual(['Guide'])
  })

  it('requires all terms to match (AND semantics)', async () => {
    await createDoc(owner.token, 'Both', 'alpha and beta')
    await createDoc(owner.token, 'Only alpha', 'alpha only')
    await createDoc(owner.token, 'Only beta', 'beta only')
    const res = await search('?q=alpha%20beta')
    expect(res.body.map((d: { name: string }) => d.name)).toEqual(['Both'])
  })

  it('filters by an exact tag case-insensitively', async () => {
    await createDoc(owner.token, 'Tagged', '# content', ['Work'])
    await createDoc(owner.token, 'Untagged', '# content', ['home'])
    const res = await search('?q=content&tag=work')
    expect(res.body.map((d: { name: string }) => d.name)).toEqual(['Tagged'])
  })

  it('returns everything in recency order for an empty query', async () => {
    await createDoc(owner.token, 'First', '# one')
    await createDoc(owner.token, 'Second', '# two')
    const res = await search('')
    expect(res.body.map((d: { name: string }) => d.name)).toEqual(['Second', 'First'])
  })

  it('respects the limit parameter', async () => {
    for (const name of ['A', 'B', 'C', 'D']) await createDoc(owner.token, name, `# ${name}`)
    expect((await search('?limit=2')).body).toHaveLength(2)
    expect((await search('?limit=2')).body.map((d: { name: string }) => d.name)).toEqual(['D', 'C'])
  })

  it('treats regex metacharacters as literals', async () => {
    await createDoc(owner.token, 'Version', '# v1.2 notes')
    const res = await search(`?q=${encodeURIComponent('v1.2')}`)
    expect(res.status).toBe(200)
    expect(res.body.map((d: { name: string }) => d.name)).toEqual(['Version'])
  })

  it('ranks title matches above body matches', async () => {
    await createDoc(owner.token, 'Alpha notes', 'keyword here')
    await createDoc(owner.token, 'keyword', '# body')
    const res = await search('?q=keyword')
    expect(res.body.map((d: { name: string }) => d.name)).toEqual(['keyword', 'Alpha notes'])
  })

  it('returns snippets and highlight ranges', async () => {
    await createDoc(owner.token, 'Snippet', '# Doc\nprefix keyword suffix')
    const res = await search('?q=keyword')
    expect(res.status).toBe(200)
    expect(res.body[0].snippet).toContain('keyword')
    expect(res.body[0].highlights[0].length).toBe(7)
    expect(res.body[0].highlights[0].start).toBeGreaterThanOrEqual(0)
  })

  it('rejects non-Markdown type searches', async () => {
    expect((await search('?type=rich')).status).toBe(400)
    expect((await search('?type=markdown')).status).toBe(200)
  })

  it('returns owner-only results and never exposes rich documents', async () => {
    const other = await registerUser(app, 'search-other-2')
    await createDoc(other.token, 'Other secret', '# hidden')
    await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Rich hidden', editorType: undefined })
    const res = await search('')
    expect(res.body.map((d: { name: string }) => d.name)).toEqual([])
  })
  it('returns P0 abilities with sharing disabled', async () => {
    await createDoc(owner.token, 'Doc', '# content')
    const res = await search('?q=content')
    expect(res.status).toBe(200)
    expect(res.body[0].abilities).toEqual({ canView: true, canEdit: true, canDelete: true, canShare: false, canComment: false, canViewHistory: false })
  })
})
