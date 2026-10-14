import express, { type Express } from 'express'
import request from 'supertest'
import { register, login, requireAuth, type AuthRequest } from '../auth'
import { getDB } from '../db'
import documentsRouter from './documents'
import sharingRouter from './sharing'
import commentsRouter from './comments'
import snapshotsRouter from './snapshots'
import type { DocumentDoc } from '../types'
import { ObjectId } from 'mongodb'
import { generateDocId } from '../docId'

/**
 * 构建与 server.ts 相同路由挂载方式的 Express app，用于 supertest。
 */
export function createTestApp(): Express {
  const app = express()
  app.use(express.json())
  app.post('/api/auth/register', register)
  app.post('/api/auth/login', login)
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user })
  })
  app.use('/api/documents', requireAuth, documentsRouter)
  app.use('/api/documents', requireAuth, sharingRouter)
  app.use('/api/documents', requireAuth, commentsRouter)
  app.use('/api/documents', requireAuth, snapshotsRouter)
  return app
}

/** 注册一个用户并返回 { token, userId, username } */
export async function registerUser(
  app: Express,
  username: string,
  password = 'pass123'
): Promise<{ token: string; userId: string; username: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, password })
  return { token: res.body.token, userId: res.body.user.id, username: res.body.user.username }
}

/** 用 supertest 创建一篇文档，返回 { id, name } */
export async function createDoc(
  app: Express,
  token: string,
  name = 'Test Doc'
): Promise<{ id: string; name: string }> {
  const res = await request(app)
    .post('/api/documents')
    .set('Authorization', `Bearer ${token}`)
    .send({ name })
  return { id: res.body.id, name: res.body.name }
}

/** 直接在 DB 中为某用户添加 document_access 记录 */
export async function grantAccess(
  documentId: string,
  userId: string,
  role: string
): Promise<void> {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: documentId })
  if (!doc) throw new Error(`Document ${documentId} not found`)
  await db.collection('document_access').insertOne({
    documentId: doc._id!,
    userId: new ObjectId(userId),
    role,
    invitedAt: new Date(),
    acceptedAt: new Date(),
  })
}
