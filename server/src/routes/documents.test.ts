import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp, registerUser, createDoc, grantAccess } from './test-helpers'
import { getDB } from '../db'
import { Role } from '../rbac'
import type { DocumentDoc } from '../types'

const app = createTestApp()

describe('GET /api/documents', () => {
  it('returns empty list for new user', async () => {
    const { token } = await registerUser(app, 'doc-empty-user')
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns owned documents', async () => {
    const { token } = await registerUser(app, 'doc-owner')
    await createDoc(app, token, 'My Doc 1')

    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('My Doc 1')
    expect(res.body[0].shared).toBe(false)
    expect(res.body[0].abilities.canDelete).toBe(true)
  })

  it('returns shared documents', async () => {
    const owner = await registerUser(app, 'doc-share-owner')
    const collaborator = await registerUser(app, 'doc-share-collab')
    const doc = await createDoc(app, owner.token, 'Shared Doc')

    await grantAccess(doc.id, collaborator.userId, Role.EDITOR)

    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${collaborator.token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Shared Doc')
    expect(res.body[0].shared).toBe(true)
    expect(res.body[0].abilities.canEdit).toBe(true)
    expect(res.body[0].abilities.canDelete).toBe(false)
  })

  it('rejects request without token', async () => {
    const res = await request(app).get('/api/documents')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/documents', () => {
  it('creates a document with custom name', async () => {
    const { token } = await registerUser(app, 'doc-create-1')
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My New Doc' })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeTruthy()
    expect(res.body.name).toBe('My New Doc')
    expect(res.body.abilities.canEdit).toBe(true)
    expect(res.body.abilities.canDelete).toBe(true)
  })

  it('creates document with default name when name is empty', async () => {
    const { token } = await registerUser(app, 'doc-create-2')
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Untitled Document')
  })
})

describe('GET /api/documents/:docId/metadata', () => {
  it('returns metadata for owner', async () => {
    const { token } = await registerUser(app, 'doc-meta-1')
    const doc = await createDoc(app, token, 'Meta Doc')

    const res = await request(app)
      .get(`/api/documents/${doc.id}/metadata`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Meta Doc')
    expect(res.body.abilities.canEdit).toBe(true)
  })

  it('returns 404 for nonexistent document', async () => {
    const { token } = await registerUser(app, 'doc-meta-2')
    const res = await request(app)
      .get('/api/documents/nonexistent/metadata')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/documents/:docId/metadata', () => {
  it('updates title as owner', async () => {
    const { token } = await registerUser(app, 'doc-patch-1')
    const doc = await createDoc(app, token, 'Old Title')

    const res = await request(app)
      .patch(`/api/documents/${doc.id}/metadata`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Title' })

    expect(res.status).toBe(200)

    // 验证 DB 已更新
    const db = getDB()
    const dbDoc = await db.collection<DocumentDoc>('documents').findOne({ docId: doc.id })
    expect(dbDoc?.title).toBe('New Title')
  })

  it('rejects update from reader (403)', async () => {
    const owner = await registerUser(app, 'doc-patch-owner')
    const reader = await registerUser(app, 'doc-patch-reader')
    const doc = await createDoc(app, owner.token, 'Protected Doc')

    await grantAccess(doc.id, reader.userId, Role.READER)

    const res = await request(app)
      .patch(`/api/documents/${doc.id}/metadata`)
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ title: 'Hacked Title' })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/documents/:docId', () => {
  it('soft-deletes as owner', async () => {
    const { token } = await registerUser(app, 'doc-del-1')
    const doc = await createDoc(app, token, 'Delete Me')

    const res = await request(app)
      .delete(`/api/documents/${doc.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const db = getDB()
    const dbDoc = await db.collection<DocumentDoc>('documents').findOne({ docId: doc.id })
    expect(dbDoc?.deletedAt).not.toBeNull()
  })

  it('rejects delete from reader (403)', async () => {
    const owner = await registerUser(app, 'doc-del-owner')
    const reader = await registerUser(app, 'doc-del-reader')
    const doc = await createDoc(app, owner.token, 'No Delete')

    await grantAccess(doc.id, reader.userId, Role.READER)

    const res = await request(app)
      .delete(`/api/documents/${doc.id}`)
      .set('Authorization', `Bearer ${reader.token}`)

    expect(res.status).toBe(403)
  })

  it('returns 404 for nonexistent document', async () => {
    const { token } = await registerUser(app, 'doc-del-2')
    const res = await request(app)
      .delete('/api/documents/nonexistent')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})
