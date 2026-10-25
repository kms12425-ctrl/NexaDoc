import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { ObjectId } from 'mongodb'
import { createTestApp, registerUser, grantAccess } from './test-helpers'
import { getDB } from '../db'
import { resolveAccess, Role } from '../rbac'
import { toBuffer } from '../persistence'
import { MAX_MARKDOWN_BYTES } from '../markdown/metadata'
import type { DocumentDoc } from '../types'

const app = createTestApp()
let owner: Awaited<ReturnType<typeof registerUser>>

beforeEach(async () => { owner = await registerUser(app, 'markdown-owner') })

function create(body: object, token = owner.token) {
  return request(app).post('/api/documents').set('Authorization', `Bearer ${token}`).send(body)
}

function list(type?: string, token = owner.token) {
  return request(app).get('/api/documents' + (type === undefined ? '' : `?type=${type}`)).set('Authorization', `Bearer ${token}`)
}

async function seed(overrides: Partial<DocumentDoc> = {}) {
  const doc: DocumentDoc = {
    docId: 'seed-' + new ObjectId().toHexString(), title: 'Legacy', ownerUserId: new ObjectId(owner.userId),
    crdtState: Buffer.from([1, 2, 3]), crdtStateSize: 3, updateCount: 2,
    createdAt: new Date(1000), updatedAt: new Date(1000), ...overrides,
  }
  await getDB().collection<DocumentDoc>('documents').insertOne(doc)
  return doc
}

describe('A2 Markdown creation', () => {
  it('stores exact template source, normalized tags and server-owned initial revision', async () => {
    const markdown = '# 会议纪要\r\n\r\n| 任务 | 负责人 |\r\n| --- | --- |\r\n| 测试 | 张三 |\r\n\n- [ ] 下一步\n'
    const res = await create({ name: '  会议纪要  ', editorType: 'markdown', markdown, tags: [' #笔记 ', '笔记', '#Work', 'work', 'two   words', null], revision: 99 })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: '会议纪要', editorType: 'markdown', tags: ['笔记', 'Work', 'two words'], revision: 0 })
    expect(res.body.id).toMatch(/^[\x20-\x7e]+$/)
    expect(res.body.abilities).toEqual({ canView: true, canEdit: true, canDelete: true, canShare: false, canComment: false, canViewHistory: false })
    expect(res.body).not.toHaveProperty('markdown')
    const doc = await getDB().collection<DocumentDoc>('documents').findOne({ docId: res.body.id })
    expect(doc).toMatchObject({ markdown, editorType: 'markdown', revision: 0, tags: ['笔记', 'Work', 'two words'], outgoingLinks: [], updateCount: 0, crdtStateSize: 0 })
    expect(doc?.ownerUserId?.toHexString()).toBe(owner.userId)
    expect(toBuffer(doc?.crdtState)).toHaveLength(0)
    expect(doc?.searchText).toContain('会议纪要')
    expect(doc?.searchText).not.toContain('| --- |')
    expect(doc?.markdownIndexedAt).toBeInstanceOf(Date)
    expect(await getDB().collection('document_access').countDocuments()).toBe(0)
  })

  it('creates blank Markdown when content is omitted', async () => {
    const res = await create({ editorType: 'markdown' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Untitled Document', tags: [], revision: 0 })
    const doc = await getDB().collection('documents').findOne({ docId: res.body.id })
    expect(doc?.markdown).toBe('')
    expect(doc?.searchText).toBe('')
  })

  it.each([undefined, 'rich'])('preserves rich creation for editorType=%s', async (editorType) => {
    const res = await create({ name: 'Rich', editorType, markdown: '# ignored', revision: 50 })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ editorType: 'rich', tags: [], revision: 0 })
    expect(res.body.abilities.canShare).toBe(true)
    const doc = await getDB().collection('documents').findOne({ docId: res.body.id })
    expect(doc).not.toHaveProperty('markdown')
    expect(doc).not.toHaveProperty('searchText')
  })

  it.each(['unknown', null, 123, ['markdown']])('rejects invalid editorType %j without inserting', async (editorType) => {
    const res = await create({ editorType })
    expect(res.status).toBe(400)
    expect(await getDB().collection('documents').countDocuments()).toBe(0)
  })

  it.each([null, 10, {}, ['# text']])('rejects non-string Markdown %j', async (markdown) => {
    expect((await create({ editorType: 'markdown', markdown })).status).toBe(400)
    expect(await getDB().collection('documents').countDocuments()).toBe(0)
  })

  it('rejects a non-string title instead of throwing an internal error', async () => {
    expect((await create({ name: { title: 'bad' } })).status).toBe(400)
  })

  it('accepts a 2 MiB source and limits the derived search index', async () => {
    const markdown = 'a'.repeat(MAX_MARKDOWN_BYTES)
    const res = await create({ editorType: 'markdown', markdown })
    expect(res.status).toBe(201)
    const doc = await getDB().collection('documents').findOne({ docId: res.body.id })
    expect(doc?.markdown).toBe(markdown)
    expect(doc?.searchText).toHaveLength(500_000)
  })

  it('checks the UTF-8 byte limit for multibyte content', async () => {
    const res = await create({ editorType: 'markdown', markdown: '中'.repeat(Math.floor(MAX_MARKDOWN_BYTES / 3) + 1) })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Markdown content too large')
    expect(await getDB().collection('documents').countDocuments()).toBe(0)
  })

  it('requires authentication', async () => {
    expect((await request(app).post('/api/documents').send({ editorType: 'markdown' })).status).toBe(401)
  })
})

describe('A3 lists and metadata', () => {
  it('filters rich, Markdown and all, including unmigrated legacy rich records', async () => {
    const legacy = await seed()
    const rich = await create({ name: 'Rich', editorType: 'rich' })
    const markdown = await create({ name: 'Markdown', editorType: 'markdown', tags: ['测试'] })
    const richList = await list('rich')
    expect(richList.status).toBe(200)
    expect(richList.body.map((doc: { id: string }) => doc.id).sort()).toEqual([legacy.docId, rich.body.id].sort())
    expect((await list('markdown')).body.map((doc: { id: string }) => doc.id)).toEqual([markdown.body.id])
    expect((await list()).body).toHaveLength(3)
    expect((await list('all')).body).toHaveLength(3)
    const rawLegacy = await getDB().collection('documents').findOne({ docId: legacy.docId })
    expect(rawLegacy).not.toHaveProperty('editorType')
  })

  it('serializes defaults without migrating or leaking bodies and index data', async () => {
    const legacy = await seed()
    const md = await seed({ editorType: 'markdown', tags: ['tag'], revision: 3, markdown: 'secret body', searchText: 'secret index', outgoingLinks: [{ title: 'secret link', targetDocId: null }] })
    const res = await list()
    expect(res.body.find((d: { id: string }) => d.id === legacy.docId)).toMatchObject({ editorType: 'rich', tags: [], revision: 0 })
    const item = res.body.find((d: { id: string }) => d.id === md.docId)
    expect(item).toMatchObject({ editorType: 'markdown', tags: ['tag'], revision: 3, shared: false })
    for (const key of ['markdown', 'searchText', 'outgoingLinks', 'crdtState', 'ownerUserId']) expect(item).not.toHaveProperty(key)
    const meta = await request(app).get(`/api/documents/${md.docId}/metadata`).set('Authorization', `Bearer ${owner.token}`)
    expect(meta.status).toBe(200)
    expect(meta.body).toMatchObject({ editorType: 'markdown', tags: ['tag'], revision: 3 })
    expect(meta.body).not.toHaveProperty('markdown')
    const legacyMeta = await request(app).get(`/api/documents/${legacy.docId}/metadata`).set('Authorization', `Bearer ${owner.token}`)
    expect(legacyMeta.body).toMatchObject({ editorType: 'rich', tags: [], revision: 0 })
  })

  it('keeps shared rich documents and excludes shared Markdown even with an admin invitation', async () => {
    const other = await registerUser(app, 'markdown-other')
    const rich = await create({ name: 'Shared rich' })
    const md = await create({ name: 'Private Markdown', editorType: 'markdown' })
    await grantAccess(rich.body.id, other.userId, Role.READER)
    await grantAccess(md.body.id, other.userId, Role.ADMIN)
    for (const type of [undefined, 'all', 'rich']) {
      const result = await list(type, other.token)
      expect(result.body).toHaveLength(1)
      expect(result.body[0]).toMatchObject({ id: rich.body.id, editorType: 'rich', shared: true })
    }
    expect((await list('markdown', other.token)).body).toEqual([])
    expect(await resolveAccess(md.body.id, other.userId)).toBeNull()
    expect(await resolveAccess(md.body.id, null)).toBeNull()
  })

  it('sorts owned and shared results together and omits deleted documents', async () => {
    const older = await seed({ updatedAt: new Date(1000) })
    const recent = await seed({ ownerUserId: new ObjectId(), updatedAt: new Date(3000) })
    await seed({ deletedAt: new Date(), updatedAt: new Date(4000) })
    await grantAccess(recent.docId, owner.userId, Role.READER)
    expect((await list()).body.map((doc: { id: string }) => doc.id)).toEqual([recent.docId, older.docId])
  })

  it.each(['unknown', '', 'markdown&type=rich', 'type[bad]=markdown'])('rejects malformed type=%s', async (type) => {
    const url = type.startsWith('type[') ? '/api/documents?' + type : '/api/documents?type=' + type
    const res = await request(app).get(url).set('Authorization', `Bearer ${owner.token}`)
    expect(res.status).toBe(400)
  })

  it.each([
    ['get', '/metadata'], ['patch', '/metadata'], ['delete', ''],
    ['get', '/access'], ['post', '/share'], ['get', '/comments'],
    ['post', '/comments'], ['put', '/preview'], ['get', '/snapshots'],
  ] as const)('returns 404 to non-owner for %s %s, including an invited admin', async (method, suffix) => {
    const other = await registerUser(app, 'private-other')
    const md = await create({ name: 'Private', editorType: 'markdown', markdown: '# Private' })
    await grantAccess(md.body.id, other.userId, Role.ADMIN)
    const res = await request(app)[method](`/api/documents/${md.body.id}${suffix}`)
      .set('Authorization', `Bearer ${other.token}`).send({ title: 'changed', body: 'comment', username: other.username })
    expect(res.status).toBe(404)
    expect((await getDB().collection('documents').findOne({ docId: md.body.id }))?.title).toBe('Private')
  })

  it.each([
    ['post', '/share'], ['get', '/access'], ['delete', '/access/507f1f77bcf86cd799439011'],
    ['get', '/comments'], ['post', '/comments'], ['patch', '/comments/507f1f77bcf86cd799439011/resolve'],
    ['get', '/snapshots'], ['post', '/snapshots'], ['post', '/snapshots/507f1f77bcf86cd799439011/restore'],
    ['put', '/preview'], ['post', '/ShArE'],
  ] as const)('keeps unsupported rich features disabled for Markdown owner: %s %s', async (method, suffix) => {
    const md = await create({ editorType: 'markdown' })
    const res = await request(app)[method](`/api/documents/${md.body.id}${suffix}`).set('Authorization', `Bearer ${owner.token}`).send({ body: 'x', content: '{}', username: owner.username })
    expect(res.status).toBe(403)
    expect(await getDB().collection('document_access').countDocuments()).toBe(0)
    expect(await getDB().collection('comments').countDocuments()).toBe(0)
    expect(await getDB().collection('snapshots').countDocuments()).toBe(0)
  })

  it('allows owner title updates and deletion, and hides metadata after deletion', async () => {
    const md = await create({ editorType: 'markdown', markdown: '# Keep body' })
    expect((await request(app).patch(`/api/documents/${md.body.id}/metadata`).set('Authorization', `Bearer ${owner.token}`).send({ title: 'Renamed' })).status).toBe(200)
    expect((await request(app).delete(`/api/documents/${md.body.id}`).set('Authorization', `Bearer ${owner.token}`)).status).toBe(200)
    expect((await list('markdown')).body).toEqual([])
    expect((await request(app).get(`/api/documents/${md.body.id}/metadata`).set('Authorization', `Bearer ${owner.token}`)).status).toBe(404)
    expect((await getDB().collection('documents').findOne({ docId: md.body.id }))?.markdown).toBe('# Keep body')
  })
  it('replaces and normalizes tags via PATCH metadata', async () => {
    const md = await create({ editorType: 'markdown', tags: ['old'] })
    const res = await request(app).patch(`/api/documents/${md.body.id}/metadata`).set('Authorization', `Bearer ${owner.token}`).send({ tags: [' #New ', 'new', '  two   words  ', null] })
    expect(res.status).toBe(200)
    expect((await getDB().collection('documents').findOne({ docId: md.body.id }))?.tags).toEqual(['New', 'two words'])
  })

  it('caps tags at 20 entries and 30 characters each', async () => {
    const md = await create({ editorType: 'markdown' })
    const tags = [...Array.from({ length: 25 }, (_, index) => `t${index}`), 'x'.repeat(31)]
    const res = await request(app).patch(`/api/documents/${md.body.id}/metadata`).set('Authorization', `Bearer ${owner.token}`).send({ tags })
    expect(res.status).toBe(200)
    const doc = await getDB().collection('documents').findOne({ docId: md.body.id })
    expect(doc?.tags).toHaveLength(20)
    expect(doc?.tags.every((tag: string) => tag.length <= 30)).toBe(true)
  })

  it('updates title and tags together', async () => {
    const md = await create({ editorType: 'markdown', tags: ['a'] })
    const res = await request(app).patch(`/api/documents/${md.body.id}/metadata`).set('Authorization', `Bearer ${owner.token}`).send({ title: 'New Title', tags: ['b'] })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('New Title')
    expect(res.body.tags).toEqual(['b'])
  })

  it('rejects non-array tags and empty patches', async () => {
    const md = await create({ editorType: 'markdown' })
    expect((await request(app).patch(`/api/documents/${md.body.id}/metadata`).set('Authorization', `Bearer ${owner.token}`).send({ tags: 'not-an-array' })).status).toBe(400)
    expect((await request(app).patch(`/api/documents/${md.body.id}/metadata`).set('Authorization', `Bearer ${owner.token}`).send({})).status).toBe(400)
  })
})
