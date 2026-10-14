import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createTestApp, registerUser, createDoc } from './test-helpers'
import { getDB } from '../db'
import type { CommentDoc } from '../types'

const app = createTestApp()

describe('GET /api/documents/:docId/comments', () => {
  it('returns empty list for new document', async () => {
    const { token } = await registerUser(app, 'comment-list-user')
    const doc = await createDoc(app, token, 'Comment Doc')

    const res = await request(app)
      .get(`/api/documents/${doc.id}/comments`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns 404 for nonexistent document', async () => {
    const { token } = await registerUser(app, 'comment-list-404')
    const res = await request(app)
      .get('/api/documents/nonexistent/comments')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('POST /api/documents/:docId/comments', () => {
  it('creates a comment', async () => {
    const { token } = await registerUser(app, 'comment-create-user')
    const doc = await createDoc(app, token, 'Comment Doc 2')

    const res = await request(app)
      .post(`/api/documents/${doc.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'This is a comment' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
  })

  it('rejects empty body', async () => {
    const { token } = await registerUser(app, 'comment-empty-user')
    const doc = await createDoc(app, token, 'Comment Doc 3')

    const res = await request(app)
      .post(`/api/documents/${doc.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Comment body required/i)
  })

  it('rejects whitespace-only body', async () => {
    const { token } = await registerUser(app, 'comment-ws-user')
    const doc = await createDoc(app, token, 'Comment Doc 4')

    const res = await request(app)
      .post(`/api/documents/${doc.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '   ' })

    expect(res.status).toBe(400)
  })

  it('returns 404 for nonexistent document', async () => {
    const { token } = await registerUser(app, 'comment-nodoc')
    const res = await request(app)
      .post('/api/documents/nonexistent/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'test' })

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/documents/:docId/comments/:commentId/resolve', () => {
  it('resolves a comment', async () => {
    const { token } = await registerUser(app, 'comment-resolve-user')
    const doc = await createDoc(app, token, 'Comment Doc 5')

    // 先创建评论
    const createRes = await request(app)
      .post(`/api/documents/${doc.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Resolve me' })

    const commentId = createRes.body.id

    // resolve
    const res = await request(app)
      .patch(`/api/documents/${doc.id}/comments/${commentId}/resolve`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // 验证 DB 中 resolved = true
    const db = getDB()
    const comment = await db.collection<CommentDoc>('comments').findOne({
      _id: createRes.body.id,
    })
    // 用 ObjectId 查
    const { ObjectId } = await import('mongodb')
    const comment2 = await db.collection<CommentDoc>('comments').findOne({
      _id: new ObjectId(commentId),
    })
    expect(comment2?.resolved).toBe(true)
  })

  it('lists comments sorted by createdAt descending', async () => {
    const { token } = await registerUser(app, 'comment-sort-user')
    const doc = await createDoc(app, token, 'Comment Doc 6')

    // 创建两条评论
    await request(app)
      .post(`/api/documents/${doc.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'First comment' })

    await new Promise((r) => setTimeout(r, 50))

    await request(app)
      .post(`/api/documents/${doc.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Second comment' })

    const res = await request(app)
      .get(`/api/documents/${doc.id}/comments`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    // 最新的在前
    expect(res.body[0].body).toBe('Second comment')
    expect(res.body[1].body).toBe('First comment')
  })
})
