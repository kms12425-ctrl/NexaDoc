import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import type { DocumentDoc, CommentDoc } from '../types'

const router = Router()

/**
 * GET /api/documents/:docId/comments — 列出评论
 */
router.get('/:docId/comments', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const comments = await db
    .collection<CommentDoc>('comments')
    .find({ documentId: doc._id! })
    .sort({ createdAt: -1 })
    .toArray()

  res.json(
    comments.map((c) => ({
      _id: c._id!.toString(),
      documentId: c.documentId.toString(),
      userId: c.userId.toString(),
      authorName: c.authorName,
      body: c.body,
      resolved: c.resolved,
      createdAt: c.createdAt.getTime(),
      updatedAt: c.updatedAt.getTime(),
    }))
  )
})

/**
 * POST /api/documents/:docId/comments — 添加评论
 */
router.post('/:docId/comments', async (req: AuthRequest, res: any) => {
  const db = getDB()
  if (!req.body.body?.trim()) {
    res.status(400).json({ error: 'Comment body required' })
    return
  }

  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const now = new Date()
  const result = await db.collection<CommentDoc>('comments').insertOne({
    documentId: doc._id!,
    userId: new ObjectId(req.user!.id),
    authorName: req.user!.username,
    body: req.body.body,
    resolved: false,
    createdAt: now,
    updatedAt: now,
  })

  res.status(201).json({ status: 'ok', id: result.insertedId.toString() })
})

/**
 * PATCH /api/documents/:docId/comments/:commentId/resolve — 解决评论
 */
router.patch('/:docId/comments/:commentId/resolve', async (req: AuthRequest, res: any) => {
  const db = getDB()
  await db.collection<CommentDoc>('comments').updateOne(
    { _id: new ObjectId(req.params.commentId as string) },
    { $set: { resolved: true, updatedAt: new Date() } }
  )
  res.json({ status: 'ok' })
})

export default router
