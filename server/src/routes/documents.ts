import { Router, Request, Response } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import { getAbilities, Role } from '../rbac'
import type { DocumentDoc, DocumentAccessDoc } from '../types'

const router = Router()

/**
 * GET /api/documents — 列出当前用户的文档（排除软删除）
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const userId = new ObjectId(req.user!.id)

  // ── 1. Owned documents ──
  const ownedDocs = await db
    .collection<DocumentDoc>('documents')
    .find(
      { ownerUserId: userId, deletedAt: null },
      { projection: { crdtState: 0 } }
    )
    .sort({ updatedAt: -1 })
    .toArray()

  const ownedResult = ownedDocs.map((d) => ({
    id: d.docId,
    name: d.title,
    createdAt: d.createdAt.getTime(),
    updatedAt: d.updatedAt.getTime(),
    abilities: getAbilities(Role.OWNER),
    shared: false,
  }))

  // ── 2. Shared documents ──
  const accessRecords = await db
    .collection<DocumentAccessDoc>('document_access')
    .find({ userId })
    .toArray()

  const docIds = accessRecords.map((a) => a.documentId)
  const roleMap = new Map(
    accessRecords.map((a) => [a.documentId.toString(), a.role as Role])
  )

  const sharedDocs = docIds.length > 0
    ? await db
        .collection<DocumentDoc>('documents')
        .find(
          { _id: { $in: docIds }, deletedAt: null },
          { projection: { crdtState: 0 } }
        )
        .sort({ updatedAt: -1 })
        .toArray()
    : []

  const sharedResult = sharedDocs.map((d) => ({
    id: d.docId,
    name: d.title,
    createdAt: d.createdAt.getTime(),
    updatedAt: d.updatedAt.getTime(),
    abilities: getAbilities(roleMap.get(d._id!.toString()) || null),
    shared: true,
  }))

  res.json([...ownedResult, ...sharedResult])
})

/**
 * POST /api/documents — 创建文档，ownerUserId 设为当前用户
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const name = (req.body.name || 'Untitled Document').trim()
  const docId = name.replace(/\s+/g, '-') + '-' + Date.now()
  const now = new Date()

  const result = await db.collection<DocumentDoc>('documents').insertOne({
    docId,
    title: name,
    ownerUserId: new ObjectId(req.user!.id),
    deletedAt: null,
    crdtState: Buffer.alloc(0),
    crdtStateSize: 0,
    updateCount: 0,
    createdAt: now,
    updatedAt: now,
  })

  res.status(201).json({
    id: docId,
    name,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    abilities: getAbilities(Role.OWNER),
  })
})

/**
 * GET /api/documents/:docId/metadata — 获取文档元数据 + 权限
 */
router.get('/:docId/metadata', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne(
    { docId: req.params.docId },
    { projection: { crdtState: 0 } }
  )
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = await db.collection<DocumentAccessDoc>('document_access').findOne({
    documentId: doc._id!,
    userId: new ObjectId(req.user!.id),
  })
  // 未被显式邀请的登录用户通过链接访问时，默认获得 EDITOR 权限（Google Docs 风格）
  const role: Role = isOwner ? Role.OWNER : (access?.role as Role) || Role.EDITOR

  res.json({
    id: doc.docId,
    name: doc.title,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
    abilities: getAbilities(role),
  })
})

/**
 * PATCH /api/documents/:docId/metadata — 更新标题（需 canEdit）
 */
router.patch('/:docId/metadata', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = await db.collection<DocumentAccessDoc>('document_access').findOne({
    documentId: doc._id!,
    userId: new ObjectId(req.user!.id),
  })
  const role: Role = isOwner ? Role.OWNER : (access?.role as Role) || Role.EDITOR
  const abilities = getAbilities(role)
  if (!abilities.canEdit) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  await db.collection<DocumentDoc>('documents').updateOne(
    { docId: req.params.docId },
    { $set: { title: req.body.title, updatedAt: new Date() } }
  )
  res.json({ status: 'ok' })
})

/**
 * DELETE /api/documents/:docId — 软删除（需 canDelete）
 */
router.delete('/:docId', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = await db.collection<DocumentAccessDoc>('document_access').findOne({
    documentId: doc._id!,
    userId: new ObjectId(req.user!.id),
  })
  const role: Role = isOwner ? Role.OWNER : (access?.role as Role) || Role.EDITOR
  const abilities = getAbilities(role)
  if (!abilities.canDelete) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  await db.collection<DocumentDoc>('documents').updateOne(
    { docId: req.params.docId },
    { $set: { deletedAt: new Date() } }
  )
  res.json({ status: 'ok' })
})

export default router
