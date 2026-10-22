import { Router } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../auth'
import { getDB } from '../db'
import { resolveAccess } from '../rbac'
import type { DocumentDoc } from '../types'

const router = Router()
router.get('/:docId/links', async (req: AuthRequest, res) => {
  const access = await resolveAccess(String(req.params.docId), req.user!.id)
  if (!access || access.doc.editorType !== 'markdown') { res.status(404).json({ error: 'Document not found' }); return }
  const db = getDB(); const ownerUserId = new ObjectId(req.user!.id)
  const backlinks = await db.collection<DocumentDoc>('documents').find({ ownerUserId, editorType: 'markdown', deletedAt: null, 'outgoingLinks.targetDocId': access.doc.docId }, { projection: { docId: 1, title: 1 } }).toArray()
  res.json({ outgoing: access.doc.outgoingLinks ?? [], backlinks: backlinks.map((doc) => ({ id: doc.docId, title: doc.title })) })
})
export default router
