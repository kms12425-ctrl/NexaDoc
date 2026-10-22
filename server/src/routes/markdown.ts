import { Router } from 'express'
import { ObjectId, type Filter } from 'mongodb'
import type { AuthRequest } from '../auth'
import { getDB } from '../db'
import { resolveAccess } from '../rbac'
import type { DocumentDoc } from '../types'
import { MAX_MARKDOWN_BYTES } from '../markdown/metadata'
import { analyzeMarkdown } from '../markdown/analyze'
import { resolveLinkTargets } from '../markdown/resolveLinkTargets'

const router = Router()

function payload(doc: DocumentDoc) {
  return { markdown: doc.markdown ?? '', revision: doc.revision ?? 0, updatedAt: doc.updatedAt.getTime() }
}

router.get('/:docId/markdown', async (req: AuthRequest, res) => {
  const access = await resolveAccess(String(req.params.docId), req.user!.id)
  if (!access || access.doc.editorType !== 'markdown') { res.status(404).json({ error: 'Document not found' }); return }
  res.json(payload(access.doc))
})

router.put('/:docId/markdown', async (req: AuthRequest, res) => {
  const docId = String(req.params.docId)
  const userId = req.user!.id
  const access = await resolveAccess(docId, userId)
  if (!access || access.doc.editorType !== 'markdown') { res.status(404).json({ error: 'Document not found' }); return }
  if (process.env.MARKDOWN_COLLAB_ENABLED === 'true') { res.status(409).json({ error: 'Collaboration enabled' }); return }
  const { markdown, baseRevision } = req.body ?? {}
  if (typeof markdown !== 'string') { res.status(400).json({ error: 'Markdown content must be a string' }); return }
  if (Buffer.byteLength(markdown, 'utf8') > MAX_MARKDOWN_BYTES) { res.status(400).json({ error: 'Markdown content too large' }); return }
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0 || baseRevision >= Number.MAX_SAFE_INTEGER) {
    res.status(400).json({ error: 'Invalid baseRevision' }); return
  }
  const documents = getDB().collection<DocumentDoc>('documents')
  const scope: Filter<DocumentDoc> = { docId, ownerUserId: new ObjectId(userId), editorType: 'markdown', deletedAt: null }
  const revisionFilter: Filter<DocumentDoc> = baseRevision === 0
    ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision: baseRevision }
  const analysis = analyzeMarkdown(markdown)
  const outgoingLinks = await resolveLinkTargets(analysis.outgoingLinks, userId, access.doc.outgoingLinks)
  const now = new Date(Math.max(Date.now(), access.doc.updatedAt.getTime() + 1))
  const updated = await documents.findOneAndUpdate({ ...scope, ...revisionFilter }, {
    $set: { markdown, searchText: analysis.searchText, outgoingLinks, markdownIndexedAt: now, updatedAt: now },
    $inc: { revision: 1 },
  }, { returnDocument: 'after' })
  if (!updated) {
    const current = await documents.findOne(scope)
    if (!current) { res.status(404).json({ error: 'Document not found' }); return }
    res.status(409).json({ error: 'Conflict', ...payload(current) })
    return
  }
  res.json({ revision: updated.revision, updatedAt: updated.updatedAt.getTime() })
})

export default router
