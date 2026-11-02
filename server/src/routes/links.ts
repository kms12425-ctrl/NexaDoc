import { Router } from 'express'
import { markdownScope } from '../markdown/access'
import type { AuthRequest } from '../auth'
import { getDB } from '../db'
import { resolveAccess } from '../rbac'
import type { DocumentDoc } from '../types'

const router = Router()
router.get('/:docId/links', async (req: AuthRequest, res) => {
  const access = await resolveAccess(String(req.params.docId), req.user!.id)
  if (!access || access.doc.editorType !== 'markdown') { res.status(404).json({ error: 'Document not found' }); return }
  const db = getDB(); const { filter } = await markdownScope(req.user!.id)
  const backlinks = await db.collection<DocumentDoc>('documents').find({ ...filter, 'outgoingLinks.targetDocId': access.doc.docId }, { projection: { docId: 1, title: 1 } }).toArray()
  const outgoing = access.doc.outgoingLinks ?? []
  const visibleTargets = await db.collection<DocumentDoc>('documents').find({ ...filter, docId: { $in: outgoing.flatMap((link) => link.targetDocId ? [link.targetDocId] : []) } }, { projection: { docId: 1 } }).toArray()
  const visibleIds = new Set(visibleTargets.map((doc) => doc.docId))
  res.json({ outgoing: outgoing.map((link) => ({ ...link, targetDocId: link.targetDocId && visibleIds.has(link.targetDocId) ? link.targetDocId : null })), backlinks: backlinks.map((doc) => ({ id: doc.docId, title: doc.title })) })
})
export default router
