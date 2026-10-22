import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { getDB } from '../db'
import { createTestApp, grantAccess, registerUser } from './test-helpers'
import { Role } from '../rbac'

const app = createTestApp()
let owner: Awaited<ReturnType<typeof registerUser>>
let id: string
beforeEach(async () => {
  owner = await registerUser(app, 'metadata-owner')
  const res = await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Original', editorType: 'markdown', markdown: '# Body', tags: ['original'] })
  id = res.body.id
})
const patch = (body: object, token = owner.token) => request(app).patch(`/api/documents/${id}/metadata`).set('Authorization', `Bearer ${token}`).send(body)

describe('A4 Markdown metadata replacement', () => {
  it('replaces and normalizes tags without changing the title or body revision', async () => {
    const before = await getDB().collection('documents').findOne({ docId: id })
    const res = await patch({ tags: [' #工作 ', '工作', ' Work ', 'work', 'two   words'], markdown: 'DO NOT WRITE', revision: 99 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', name: 'Original', tags: ['工作', 'Work', 'two words'], revision: 0 })
    const after = await getDB().collection('documents').findOne({ docId: id })
    for (const key of ['markdown', 'revision', 'searchText', 'outgoingLinks', 'crdtState', 'markdownIndexedAt', 'createdAt']) expect(after?.[key]).toEqual(before?.[key])
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime())
    expect(res.body).not.toHaveProperty('markdown')
    expect((await patch({ tags: [] })).body.tags).toEqual([])
  })
  it('saves a trimmed title independently, or title and tags together', async () => {
    expect((await patch({ title: ' 新标题 ' })).body).toMatchObject({ name: '新标题', tags: ['original'] })
    expect((await patch({ title: 'Combined', tags: ['new'] })).body).toMatchObject({ name: 'Combined', tags: ['new'] })
  })
  it('accepts exact limits and ignores case-only duplicates before counting', async () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag-${i}`)
    expect((await patch({ title: '中'.repeat(120), tags: [...tags, 'TAG-0'] })).status).toBe(200)
    expect((await patch({ tags: ['中'.repeat(30)] })).status).toBe(200)
  })
  it.each([
    {}, { markdown: 'body only' }, { title: '' }, { title: '  ' }, { title: 42 }, { title: '中'.repeat(121) },
    { tags: null }, { tags: 'work' }, { tags: [42] }, { tags: [''] }, { tags: ['###'] },
    { tags: ['中'.repeat(31)] }, { tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`) },
  ])('rejects invalid metadata atomically: %j', async (body) => {
    const before = await getDB().collection('documents').findOne({ docId: id })
    expect((await patch(body)).status).toBe(400)
    const after = await getDB().collection('documents').findOne({ docId: id })
    expect(after).toEqual(before)
  })
  it('does not partially rename when the accompanying tags are invalid', async () => {
    expect((await patch({ title: 'Must not save', tags: ['x'.repeat(31)] })).status).toBe(400)
    expect((await getDB().collection('documents').findOne({ docId: id }))?.title).toBe('Original')
  })
  it('denies anonymous and non-owner writes even with an old administrator invitation', async () => {
    expect((await request(app).patch(`/api/documents/${id}/metadata`).send({ tags: [] })).status).toBe(401)
    const other = await registerUser(app, 'metadata-other')
    await grantAccess(id, other.userId, Role.ADMIN)
    expect((await patch({ title: 'Denied', tags: [] }, other.token)).status).toBe(404)
    await getDB().collection('documents').updateOne({ docId: id }, { $set: { deletedAt: new Date() } })
    expect((await patch({ tags: [] })).status).toBe(404)
  })
  it('keeps rich title updates and role enforcement working', async () => {
    const res = await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Rich' })
    id = res.body.id
    expect((await patch({ title: 'Rich renamed' })).body.status).toBe('ok')
    const reader = await registerUser(app, 'metadata-reader')
    await grantAccess(id, reader.userId, Role.READER)
    expect((await patch({ title: 'Denied' }, reader.token)).status).toBe(403)
  })
})
