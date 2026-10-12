import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createTestApp, registerUser, createDoc, grantAccess } from './test-helpers'
import { getDB } from '../db'
import { Role } from '../rbac'
import type { SnapshotDoc } from '../types'
import { ObjectId } from 'mongodb'

const app = createTestApp()

describe('GET /api/documents/:docId/snapshots', () => {
  it('returns empty list for owner', async () => {
    const { token } = await registerUser(app, 'snap-list-owner')
    const doc = await createDoc(app, token, 'Snap Doc')

    const res = await request(app)
      .get(`/api/documents/${doc.id}/snapshots`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('rejects reader (403, no canViewHistory)', async () => {
    const owner = await registerUser(app, 'snap-list-reader-owner')
    const reader = await registerUser(app, 'snap-list-reader')
    const doc = await createDoc(app, owner.token, 'Protected Snap')

    await grantAccess(doc.id, reader.userId, Role.READER)

    const res = await request(app)
      .get(`/api/documents/${doc.id}/snapshots`)
      .set('Authorization', `Bearer ${reader.token}`)

    expect(res.status).toBe(403)
  })

  it('returns 404 for nonexistent document', async () => {
    const { token } = await registerUser(app, 'snap-list-404')
    const res = await request(app)
      .get('/api/documents/nonexistent/snapshots')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('POST /api/documents/:docId/snapshots', () => {
  it('creates a snapshot', async () => {
    const { token } = await registerUser(app, 'snap-create-user')
    const doc = await createDoc(app, token, 'Snap Create')

    const res = await request(app)
      .post(`/api/documents/${doc.id}/snapshots`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v1', preview: 'Hello', content: '{"type":"doc"}' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
  })

  it('rejects content > 1MB (413)', async () => {
    const { token } = await registerUser(app, 'snap-create-large')
    const doc = await createDoc(app, token, 'Snap Large')

    const hugeContent = 'x'.repeat(1_000_001)
    const res = await request(app)
      .post(`/api/documents/${doc.id}/snapshots`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'big', preview: '', content: hugeContent })

    // 413 可能来自 Express body 限制或路由逻辑
    expect(res.status).toBe(413)
  })

  it('rejects reader (403)', async () => {
    const owner = await registerUser(app, 'snap-create-reader-owner')
    const reader = await registerUser(app, 'snap-create-reader')
    const doc = await createDoc(app, owner.token, 'No Snap')

    await grantAccess(doc.id, reader.userId, Role.READER)

    const res = await request(app)
      .post(`/api/documents/${doc.id}/snapshots`)
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ name: 'v1', preview: '', content: '{}' })

    expect(res.status).toBe(403)
  })
})

describe('POST /api/documents/:docId/snapshots/:snapshotId/restore', () => {
  it('restores a snapshot as owner', async () => {
    const { token } = await registerUser(app, 'snap-restore-owner')
    const doc = await createDoc(app, token, 'Restore Doc')

    // 先创建快照
    const snapRes = await request(app)
      .post(`/api/documents/${doc.id}/snapshots`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v1', preview: 'preview', content: '{"type":"doc"}' })

    const snapshotId = snapRes.body.id

    // 恢复
    const res = await request(app)
      .post(`/api/documents/${doc.id}/snapshots/${snapshotId}/restore`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('crdtState')
    expect(Array.isArray(res.body.crdtState)).toBe(true)
    expect(res.body.contentJson).toBe('{"type":"doc"}')
  })

  it('returns 404 for nonexistent snapshot', async () => {
    const { token } = await registerUser(app, 'snap-restore-404')
    const doc = await createDoc(app, token, 'Restore 404')

    const fakeId = new ObjectId().toString()
    const res = await request(app)
      .post(`/api/documents/${doc.id}/snapshots/${fakeId}/restore`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  it('rejects invalid snapshot id (400)', async () => {
    const { token } = await registerUser(app, 'snap-restore-invalid')
    const doc = await createDoc(app, token, 'Restore Invalid')

    const res = await request(app)
      .post(`/api/documents/${doc.id}/snapshots/invalid-id/restore`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  it('rejects restore from reader (403, no canEdit)', async () => {
    const owner = await registerUser(app, 'snap-restore-reader-owner')
    const reader = await registerUser(app, 'snap-restore-reader')
    const doc = await createDoc(app, owner.token, 'No Restore')

    await grantAccess(doc.id, reader.userId, Role.READER)

    // owner 先创建快照
    const snapRes = await request(app)
      .post(`/api/documents/${doc.id}/snapshots`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'v1', preview: '', content: '{}' })

    // reader 尝试恢复
    const res = await request(app)
      .post(`/api/documents/${doc.id}/snapshots/${snapRes.body.id}/restore`)
      .set('Authorization', `Bearer ${reader.token}`)

    expect(res.status).toBe(403)
  })

  it('cross-document restore returns 404', async () => {
    const { token } = await registerUser(app, 'snap-cross-user')
    const docA = await createDoc(app, token, 'Doc A')
    const docB = await createDoc(app, token, 'Doc B')

    // 在 docA 创建快照
    const snapRes = await request(app)
      .post(`/api/documents/${docA.id}/snapshots`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v1', preview: '', content: '{}' })

    // 尝试用 docA 的 snapshotId 恢复到 docB
    const res = await request(app)
      .post(`/api/documents/${docB.id}/snapshots/${snapRes.body.id}/restore`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})
