import type { NextFunction, Response } from 'express'
import { getDB } from '../db'
import type { AuthRequest } from '../auth'
import type { DocumentDoc } from '../types'

/** Runs before all /documents routers, including older endpoints that bypass resolveAccess. */
export async function restrictMarkdownRoutes(req: AuthRequest, res: Response, next: NextFunction) {
  const doc = await getDB().collection<DocumentDoc>('documents').findOne(
    { docId: String(req.params.docId) },
    { projection: { editorType: 1, ownerUserId: 1, deletedAt: 1 } },
  )
  if (doc?.editorType !== 'markdown') { next(); return }
  if (doc.deletedAt || doc.ownerUserId?.toString() !== req.user!.id) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  if (/^\/(?:share|access|comments|snapshots|preview)(?:\/|$)/i.test(req.path)) {
    res.status(403).json({ error: 'This feature is not available for Markdown documents' })
    return
  }
  next()
}
