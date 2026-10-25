import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createTestApp, registerUser, grantAccess } from './test-helpers'
import { Role } from '../rbac'
import { getDB } from '../db'

const app = createTestApp()
let owner: Awaited<ReturnType<typeof registerUser>>

beforeEach(async () => { owner = await registerUser(app, 'links-owner') })

function createDoc(name: string) {
  return request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name, editorType: 'markdown' })
}
// 双链只在 PUT markdown 保存时解析（POST 创建不分析 outgoingLinks）。
function saveLinks(id: string, markdown: string) {
  return request(app).put(`/api/documents/${id}/markdown`).set('Authorization', `Bearer ${owner.token}`).send({ markdown, baseRevision: 0 })
}
function getLinks(id: string, token = owner.token) {
  return request(app).get(`/api/documents/${id}/links`).set('Authorization', `Bearer ${token}`)
}

describe('A8 outbound links and backlinks', () => {
  it('returns resolved outgoing links', async () => {
    const target = await createDoc('目标页面')
    const source = await createDoc('Source')
    await saveLinks(source.body.id, 'See [[目标页面]]')
    const res = await getLinks(source.body.id)
    expect(res.status).toBe(200)
    expect(res.body.outgoing).toEqual([{ title: '目标页面', targetDocId: target.body.id }])
    expect(res.body.backlinks).toEqual([])
  })

  it('leaves unknown and ambiguous titles unresolved', async () => {
    const source = await createDoc('Source')
    await createDoc('目标')
    await createDoc('目标')
    await saveLinks(source.body.id, 'See [[不存在]] and [[目标]]')
    const res = await getLinks(source.body.id)
    expect(res.body.outgoing).toEqual([
      { title: '不存在', targetDocId: null },
      { title: '目标', targetDocId: null },
    ])
  })

  it('lists backlinks from documents that reference this one', async () => {
    const target = await createDoc('Target')
    const source = await createDoc('Source')
    await saveLinks(source.body.id, 'See [[Target]]')
    const res = await getLinks(target.body.id)
    expect(res.body.backlinks).toEqual([{ id: source.body.id, title: 'Source' }])
    expect(res.body.outgoing).toEqual([])
  })

  it('keeps the targetDocId stable after the target is renamed', async () => {
    const target = await createDoc('Project Home')
    const source = await createDoc('Source')
    await saveLinks(source.body.id, 'See [[Project Home]]')
    await request(app).patch(`/api/documents/${target.body.id}/metadata`).set('Authorization', `Bearer ${owner.token}`).send({ title: 'Project Overview' })
    const res = await getLinks(source.body.id)
    expect(res.body.outgoing).toEqual([{ title: 'Project Home', targetDocId: target.body.id }])
    expect((await getLinks(target.body.id)).body.backlinks).toEqual([{ id: source.body.id, title: 'Source' }])
  })

  it('returns 404 to non-owners even with an old invitation', async () => {
    const other = await registerUser(app, 'links-other')
    const source = await createDoc('Source')
    await grantAccess(source.body.id, other.userId, Role.ADMIN)
    expect((await getLinks(source.body.id, other.token)).status).toBe(404)
  })

  it('returns 404 for rich and deleted documents', async () => {
    const rich = await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Rich' })
    expect((await getLinks(rich.body.id)).status).toBe(404)
    const md = await createDoc('Deleted')
    await getDB().collection('documents').updateOne({ docId: md.body.id }, { $set: { deletedAt: new Date() } })
    expect((await getLinks(md.body.id)).status).toBe(404)
  })

  it('excludes deleted documents from backlinks', async () => {
    const target = await createDoc('Target')
    const source = await createDoc('Source')
    await saveLinks(source.body.id, 'See [[Target]]')
    await getDB().collection('documents').updateOne({ docId: source.body.id }, { $set: { deletedAt: new Date() } })
    expect((await getLinks(target.body.id)).body.backlinks).toEqual([])
  })
})
  it('requires authentication', async () => {
    const source = await createDoc('Source')
    expect((await request(app).get(`/api/documents/${source.body.id}/links`)).status).toBe(401)
  })

