import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { createTestApp, registerUser, createDoc, grantAccess } from './test-helpers'
import { Role } from '../rbac'

const app = createTestApp()

describe('GET /api/documents/:docId/access', () => {
  it('returns only owner when no collaborators', async () => {
    const owner = await registerUser(app, 'share-get-owner')
    const doc = await createDoc(app, owner.token, 'Solo Doc')

    const res = await request(app)
      .get(`/api/documents/${doc.id}/access`)
      .set('Authorization', `Bearer ${owner.token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].username).toBe('share-get-owner')
    expect(res.body[0].role).toBe(Role.OWNER)
  })

  it('returns 404 for nonexistent document', async () => {
    const { token } = await registerUser(app, 'share-get-404')
    const res = await request(app)
      .get('/api/documents/nonexistent/access')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('POST /api/documents/:docId/share', () => {
  it('invites a collaborator as reader', async () => {
    const owner = await registerUser(app, 'share-invite-owner')
    const target = await registerUser(app, 'share-invite-target')
    const doc = await createDoc(app, owner.token, 'Share Me')

    const res = await request(app)
      .post(`/api/documents/${doc.id}/share`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ username: 'share-invite-target', role: Role.READER })

    expect(res.status).toBe(200)

    // 验证 access 列表中有新协作者
    const accessRes = await request(app)
      .get(`/api/documents/${doc.id}/access`)
      .set('Authorization', `Bearer ${owner.token}`)

    const collaborator = accessRes.body.find((a: any) => a.username === 'share-invite-target')
    expect(collaborator).toBeTruthy()
    expect(collaborator.role).toBe(Role.READER)
  })

  it('rejects share from non-owner/non-admin (403)', async () => {
    const owner = await registerUser(app, 'share-noperm-owner')
    const editor = await registerUser(app, 'share-noperm-editor')
    const target = await registerUser(app, 'share-noperm-target')
    const doc = await createDoc(app, owner.token, 'No Perm')

    await grantAccess(doc.id, editor.userId, Role.EDITOR)

    const res = await request(app)
      .post(`/api/documents/${doc.id}/share`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ username: 'share-noperm-target', role: Role.READER })

    expect(res.status).toBe(403)
  })

  it('returns 404 when inviting nonexistent user', async () => {
    const { token } = await registerUser(app, 'share-nouser')
    const doc = await createDoc(app, token, 'No User')

    const res = await request(app)
      .post(`/api/documents/${doc.id}/share`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'ghost-user', role: Role.READER })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/User not found/i)
  })

  it('returns 404 for nonexistent document', async () => {
    const { token } = await registerUser(app, 'share-nodoc')
    const res = await request(app)
      .post('/api/documents/nonexistent/share')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'someone', role: Role.READER })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/documents/:docId/access/:userId', () => {
  it('removes collaborator as owner', async () => {
    const owner = await registerUser(app, 'share-remove-owner')
    const collaborator = await registerUser(app, 'share-remove-collab')
    const doc = await createDoc(app, owner.token, 'Remove Me')

    await grantAccess(doc.id, collaborator.userId, Role.EDITOR)

    const res = await request(app)
      .delete(`/api/documents/${doc.id}/access/${collaborator.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)

    expect(res.status).toBe(200)

    // 验证协作者已被移除
    const accessRes = await request(app)
      .get(`/api/documents/${doc.id}/access`)
      .set('Authorization', `Bearer ${owner.token}`)

    const removed = accessRes.body.find((a: any) => a.username === 'share-remove-collab')
    expect(removed).toBeUndefined()
  })

  it('rejects removal from non-owner (403)', async () => {
    const owner = await registerUser(app, 'share-remove-noperm-owner')
    const collaborator = await registerUser(app, 'share-remove-noperm-collab')
    const doc = await createDoc(app, owner.token, 'No Remove')

    await grantAccess(doc.id, collaborator.userId, Role.EDITOR)

    const res = await request(app)
      .delete(`/api/documents/${doc.id}/access/${collaborator.userId}`)
      .set('Authorization', `Bearer ${collaborator.token}`)

    expect(res.status).toBe(403)
  })
})
