import type { NextFunction, Response } from 'express'
import { getDB } from '../db'
import { resolveAccess } from '../rbac'
import type { AuthRequest } from '../auth'
import type { DocumentDoc } from '../types'

/** Runs before all /documents routers, including older endpoints that bypass resolveAccess. */
export async function restrictMarkdownRoutes(req: AuthRequest, res: Response, next: NextFunction) {
  const doc = await getDB().collection<DocumentDoc>('documents').findOne(
    { docId: String(req.params.docId) },
    { projection: { editorType: 1, ownerUserId: 1, deletedAt: 1 } },
  )
  if (doc?.editorType !== 'markdown') { next(); return }
  const access = await resolveAccess(String(req.params.docId), req.user!.id)
  if (!access) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  if (/^\/(?:comments|snapshots|preview)(?:\/|$)/i.test(req.path) ||
      (/^\/(?:share|access)(?:\/|$)/i.test(req.path) && !access.abilities.canShare)) {
    res.status(403).json({ error: 'This feature is not available for Markdown documents' })
    return
  }
  next()
}
