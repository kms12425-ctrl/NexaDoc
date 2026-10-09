import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import { Role } from '../rbac'
import { notifyUser } from '../notifications'
import type { DocumentDoc, DocumentAccessDoc, UserDoc } from '../types'

const router = Router()

/**
 * GET /api/documents/:docId/access — 列出协作者
 */
router.get('/:docId/access', async (req: AuthRequest, res: any) =>
{
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const access = await db
    .collection<DocumentAccessDoc>('document_access')
    .find({ documentId: doc._id! })
    .toArray()

  // 关联用户信息
  const userIds = access.map((a) => a.userId)
  const users = await db
    .collection<UserDoc>('users')
    .find({ _id: { $in: userIds } })
    .toArray()
  const userMap = new Map(users.map((u) => [u._id!.toString(), u]))

  // owner 信息
  let ownerInfo: any = null
  if (doc.ownerUserId) {
    const owner = await db.collection<UserDoc>('users').findOne({ _id: doc.ownerUserId as any })
    if (owner) {
      ownerInfo = {
        userId: owner._id!.toString(),
        username: owner.username,
        role: Role.OWNER,
      }
    }
  }

  const result = access.map((a) => ({
    _id: a._id!.toString(),
    userId: a.userId.toString(),
    username: userMap.get(a.userId.toString())?.username || 'unknown',
    role: a.role,
    invitedAt: a.invitedAt.getTime(),
    acceptedAt: a.acceptedAt?.getTime() || null,
  }))

  // 把 owner 放到列表最前
  if (ownerInfo) {
    result.unshift(ownerInfo)
  }

  res.json(result)
})

/**
 * POST /api/documents/:docId/share — 邀请协作者
 */
router.post('/:docId/share', async (req: AuthRequest, res: any) =>
{
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  // 权限检查：只有 owner/admin 可以分享
  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = await db.collection<DocumentAccessDoc>('document_access').findOne({
    documentId: doc._id!,
    userId: new ObjectId(req.user!.id),
  })
  const role: Role | null = isOwner ? Role.OWNER : (access?.role as Role) || null
  if (role !== Role.OWNER && role !== Role.ADMIN) {
    res.status(403).json({ error: 'Only owner/admin can share' })
    return
  }

  const targetUser = await db.collection<UserDoc>('users').findOne({ username: req.body.username })
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const targetRole = req.body.role || Role.READER
  await db.collection<DocumentAccessDoc>('document_access').updateOne(
    { documentId: doc._id!, userId: targetUser._id! },
    {
      $set: {
        role: targetRole,
        invitedAt: new Date(),
        acceptedAt: new Date(),
        invitedBy: new ObjectId(req.user!.id),
      },
    },
    { upsert: true }
  )

  // ── 向被邀请用户推送实时通知 ──
  notifyUser(targetUser._id!.toString(), {
    type: 'document-shared',
    docId: doc.docId,
    name: doc.title,
    sharedBy: req.user!.username,
    role: targetRole,
  })

  res.json({ status: 'ok' })
})

/**
 * DELETE /api/documents/:docId/access/:userId — 移除协作者
 */
router.delete('/:docId/access/:userId', async (req: AuthRequest, res: any) =>
{
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  if (!isOwner) {
    res.status(403).json({ error: 'Only owner can remove collaborators' })
    return
  }

  await db.collection<DocumentAccessDoc>('document_access').deleteOne({
    documentId: doc._id!,
    userId: new ObjectId(req.params.userId as string),
  })

  res.json({ status: 'ok' })
})

export default router
