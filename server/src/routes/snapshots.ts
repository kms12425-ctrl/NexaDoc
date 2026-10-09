import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import { resolveAccess } from '../rbac'
import { toBuffer } from '../persistence'
import type { SnapshotDoc } from '../types'

const router = Router()

/** 快照正文（TipTap JSON 字符串）体积上限，防止超大请求 */
const MAX_CONTENT_JSON_BYTES = 1_000_000

/**
 * GET /api/documents/:docId/snapshots — 列出快照
 */
router.get('/:docId/snapshots', async (req: AuthRequest, res: any) =>
{
  const db = getDB()
  const access = await resolveAccess(req.params.docId as string, req.user!.id)
  if (!access) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  if (!access.abilities.canViewHistory) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }
  const snapshots = await db
    .collection<SnapshotDoc>('snapshots')
    .find({ documentId: access.doc._id! }, { projection: { crdtState: 0 } })
    .sort({ createdAt: -1 })
    .toArray()

  res.json(
    snapshots.map((s) => ({
      _id: s._id!.toString(),
      name: s.name,
      authorName: s.authorName,
      preview: s.preview,
      createdAt: s.createdAt.getTime(),
    }))
  )
})

/**
 * POST /api/documents/:docId/snapshots — 创建快照
 */
router.post('/:docId/snapshots', async (req: AuthRequest, res: any) =>
{
  const db = getDB()
  const access = await resolveAccess(req.params.docId as string, req.user!.id)
  if (!access) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  if (!access.abilities.canViewHistory) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  // ⚠ 只存 crdtState 是不够的：Yjs 的更新只能合并、不能回退（applyUpdate 是只增的），
  // 所以恢复时必须依靠一份「可重放」的正文——这里存 TipTap JSON。
  const contentJson = typeof req.body.content === 'string' ? req.body.content : ''
  if (Buffer.byteLength(contentJson, 'utf8') > MAX_CONTENT_JSON_BYTES) {
    res.status(413).json({ error: 'Snapshot content too large' })
    return
  }

  // 取服务端已持久化的 CRDT 状态（客户端改动会 1s debounce 后写入），
  // 必须用 toBuffer 归一化：BSON Binary 没有 .length
  const state = toBuffer(access.doc.crdtState)
  const result = await db.collection<SnapshotDoc>('snapshots').insertOne({
    documentId: access.doc._id!,
    name: req.body.name || `Revision ${Date.now()}`,
    crdtState: state,
    crdtStateSize: state.length,
    authorUserId: new ObjectId(req.user!.id),
    authorName: req.user!.username,
    preview: req.body.preview || '',
    contentJson,
    createdAt: new Date(),
  })

  res.status(201).json({ status: 'ok', id: result.insertedId.toString() })
})

/**
 * POST /api/documents/:docId/snapshots/:snapshotId/restore — 恢复快照
 */
router.post('/:docId/snapshots/:snapshotId/restore', async (req: AuthRequest, res: any) =>
{
  const db = getDB()
  const access = await resolveAccess(req.params.docId as string, req.user!.id)
  if (!access) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  if (!access.abilities.canEdit) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }
  if (!ObjectId.isValid(req.params.snapshotId as string)) {
    res.status(400).json({ error: 'Invalid snapshot id' })
    return
  }

  // 必须限定在本文档内查找——否则拿着别的文档的 snapshotId 就能读走它的内容
  const snap = await db.collection<SnapshotDoc>('snapshots').findOne({
    _id: new ObjectId(req.params.snapshotId as string),
    documentId: access.doc._id!,
  })
  if (!snap) {
    res.status(404).json({ error: 'Snapshot not found' })
    return
  }
  res.json({
    crdtState: Array.from(toBuffer(snap.crdtState)),
    // 旧格式快照没有这个字段（这里返回 null，客户端会提示无法恢复）
    contentJson: snap.contentJson || null,
  })
})

export default router
