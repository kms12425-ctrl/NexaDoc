import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import type { DocumentDoc, SnapshotDoc } from '../types'

const router = Router()

/**
 * GET /api/documents/:docId/snapshots — 列出快照
 */
router.get('/:docId/snapshots', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  const snapshots = await db
    .collection<SnapshotDoc>('snapshots')
    .find({ documentId: doc._id! }, { projection: { crdtState: 0 } })
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
router.post('/:docId/snapshots', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const state = doc.crdtState
  const result = await db.collection<SnapshotDoc>('snapshots').insertOne({
    documentId: doc._id!,
    name: req.body.name || `Revision ${Date.now()}`,
    crdtState: state,
    crdtStateSize: state.length,
    authorUserId: new ObjectId(req.user!.id),
    authorName: req.user!.username,
    preview: req.body.preview || '',
    createdAt: new Date(),
  })

  res.status(201).json({ status: 'ok', id: result.insertedId.toString() })
})

/**
 * POST /api/documents/:docId/snapshots/:snapshotId/restore — 恢复快照
 */
router.post('/:docId/snapshots/:snapshotId/restore', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const snap = await db.collection<SnapshotDoc>('snapshots').findOne({
    _id: new ObjectId(req.params.snapshotId as string),
  })
  if (!snap) {
    res.status(404).json({ error: 'Snapshot not found' })
    return
  }
  res.json({
    crdtState: Array.from(new Uint8Array(snap.crdtState.buffer)),
  })
})

export default router
