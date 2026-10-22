import { beforeEach, describe, expect, it, afterEach, vi } from 'vitest'
import request from 'supertest'
import { ObjectId } from 'mongodb'
import { createTestApp, registerUser, grantAccess } from './test-helpers'
import { getDB } from '../db'
import { toBuffer } from '../persistence'
import { Role } from '../rbac'
import { MAX_MARKDOWN_BYTES } from '../markdown/metadata'

const app = createTestApp()
let token: string
let docId: string
let userId: string
beforeEach(async () => {
  const owner = await registerUser(app, 'save-owner')
  token = owner.token; userId = owner.userId
  const res = await request(app).post('/api/documents').set('Authorization', `Bearer ${token}`).send({ name: 'Save test', editorType: 'markdown', markdown: '# Initial' })
  docId = res.body.id
})
afterEach(() => vi.unstubAllEnvs())
const load = (id = docId, auth = token) => request(app).get(`/api/documents/${id}/markdown`).set('Authorization', `Bearer ${auth}`)
const save = (body: object, id = docId, auth = token) => request(app).put(`/api/documents/${id}/markdown`).set('Authorization', `Bearer ${auth}`).send(body)

describe('Markdown body GET/PUT required by B2', () => {
  it('loads the initial template source and revision', async () => {
    const res = await load()
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ markdown: '# Initial', revision: 0 })
    expect(typeof res.body.updatedAt).toBe('number')
  })
  it('saves exact source, increments revision and refreshes derived indexes without touching rich state', async () => {
    const source = '# 中文标题\r\n\n- [ ] 任务\n[[不存在|显示文字]]\n```text\n[[示例]]\n```\n'
    const res = await save({ markdown: source, baseRevision: 0 })
    expect(res.status).toBe(200)
    expect(res.body.revision).toBe(1)
    expect((await load()).body.markdown).toBe(source)
    const doc = await getDB().collection('documents').findOne({ docId })
    expect(doc).toMatchObject({ revision: 1, markdown: source, outgoingLinks: [{ title: '不存在', label: '显示文字', targetDocId: null }], tags: [], title: 'Save test', crdtStateSize: 0, updateCount: 0 })
    expect(doc?.searchText).toContain('中文标题')
    expect(doc?.markdownIndexedAt).toBeInstanceOf(Date)
    expect(toBuffer(doc?.crdtState)).toHaveLength(0)
  })
  it('returns the current source on a stale revision and does not overwrite it', async () => {
    await save({ markdown: 'First writer', baseRevision: 0 })
    const res = await save({ markdown: 'Stale writer', baseRevision: 0 })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'Conflict', markdown: 'First writer', revision: 1 })
    expect((await load()).body.markdown).toBe('First writer')
  })
  it('permits only one of two simultaneous writers using the same revision', async () => {
    const results = await Promise.all([save({ markdown: 'A', baseRevision: 0 }), save({ markdown: 'B', baseRevision: 0 })])
    expect(results.map((result) => result.status).sort()).toEqual([200, 409])
    expect((await load()).body.revision).toBe(1)
  })
  it('initializes a missing legacy Markdown revision atomically', async () => {
    await getDB().collection('documents').updateOne({ docId }, { $unset: { revision: '' } })
    expect((await load()).body.revision).toBe(0)
    expect((await save({ markdown: 'Saved', baseRevision: 0 })).body.revision).toBe(1)
  })
  it.each([undefined, null, '0', -1, 0.5, {}, Number.MAX_SAFE_INTEGER])('rejects invalid baseRevision %j', async (baseRevision) => {
    expect((await save({ markdown: 'Invalid', baseRevision })).status).toBe(400)
    expect((await load()).body.revision).toBe(0)
  })
  it.each([undefined, null, 123, ['source']])('rejects non-string source %j', async (markdown) => {
    expect((await save({ markdown, baseRevision: 0 })).status).toBe(400)
  })
  it('enforces UTF-8 size limits while accepting empty source', async () => {
    expect((await save({ markdown: '中'.repeat(Math.floor(MAX_MARKDOWN_BYTES / 3) + 1), baseRevision: 0 })).status).toBe(400)
    expect((await save({ markdown: '', baseRevision: 0 })).status).toBe(200)
    expect((await load()).body.markdown).toBe('')
  })
  it('resolves unique owned Markdown targets and leaves foreign/ambiguous titles unresolved', async () => {
    const docs = getDB().collection('documents')
    const template = await docs.findOne({ docId })
    for (const [id, title, owner] of [
      ['target', '目标', new ObjectId(userId)], ['foreign', '秘密', new ObjectId()],
      ['duplicate-1', '重复', new ObjectId(userId)], ['duplicate-2', '重复', new ObjectId(userId)],
    ]) await docs.insertOne({ ...template, _id: new ObjectId(), docId: id, title, ownerUserId: owner })
    expect((await save({ markdown: '[[目标]] [[秘密]] [[重复]]', baseRevision: 0 })).status).toBe(200)
    const doc = await docs.findOne({ docId })
    expect(doc?.outgoingLinks).toEqual([{ title: '目标', targetDocId: 'target' }, { title: '秘密', targetDocId: null }, { title: '重复', targetDocId: null }])
  })
  it('keeps an existing targetDocId when the target document is renamed and the source is saved again', async () => {
    const target = await request(app).post('/api/documents').set('Authorization', `Bearer ${token}`).send({ name: 'Project Home', editorType: 'markdown' })
    const source = 'See [[Project Home]]'
    expect((await save({ markdown: source, baseRevision: 0 })).status).toBe(200)

    expect((await request(app).patch(`/api/documents/${target.body.id}/metadata`).set('Authorization', `Bearer ${token}`).send({ title: 'Project Overview' })).status).toBe(200)
    expect((await save({ markdown: source, baseRevision: 1 })).status).toBe(200)

    const doc = await getDB().collection('documents').findOne({ docId })
    expect(doc?.outgoingLinks).toEqual([{ title: 'Project Home', targetDocId: target.body.id }])
  })
  it('does not update the title or tags supplied in a save request', async () => {
    await save({ markdown: 'Changed', baseRevision: 0, title: 'Hijack', tags: ['no'] })
    expect((await getDB().collection('documents').findOne({ docId }))?.title).toBe('Save test')
  })
  it('returns 404 for rich and deleted documents', async () => {
    const rich = await request(app).post('/api/documents').set('Authorization', `Bearer ${token}`).send({ name: 'Rich' })
    expect((await load(rich.body.id)).status).toBe(404)
    expect((await save({ markdown: 'Bad', baseRevision: 0 }, rich.body.id)).status).toBe(404)
    await getDB().collection('documents').updateOne({ docId }, { $set: { deletedAt: new Date() } })
    expect((await load()).status).toBe(404)
    expect((await save({ markdown: 'Bad', baseRevision: 0 })).status).toBe(404)
  })
  it('denies another account even with an old administrator invitation', async () => {
    const other = await registerUser(app, 'save-other')
    await grantAccess(docId, other.userId, Role.ADMIN)
    expect((await load(docId, other.token)).status).toBe(404)
    expect((await save({ markdown: 'Bad', baseRevision: 0 }, docId, other.token)).status).toBe(404)
  })
  it('requires authentication for both body endpoints', async () => {
    expect((await request(app).get(`/api/documents/${docId}/markdown`)).status).toBe(401)
    expect((await request(app).put(`/api/documents/${docId}/markdown`).send({ markdown: '', baseRevision: 0 })).status).toBe(401)
  })
  it('refuses REST writes when future collaboration mode is enabled', async () => {
    vi.stubEnv('MARKDOWN_COLLAB_ENABLED', 'true')
    const res = await save({ markdown: 'Do not write', baseRevision: 0 })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('Collaboration enabled')
    expect((await load()).body.markdown).toBe('# Initial')
  })
})
