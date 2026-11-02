import { ObjectId, type Filter } from 'mongodb'
import { getDB } from '../db'
import { markdownSharingEnabled, MARKDOWN_SHARE_ROLES, Role } from '../rbac'
import type { DocumentAccessDoc, DocumentDoc } from '../types'

/** Shared visibility for search, tags, suggestions and link indexes. Never uses link defaults. */
export async function markdownScope(userId: string) {
  const ownerUserId = new ObjectId(userId)
  const invitations = markdownSharingEnabled()
    ? await getDB().collection<DocumentAccessDoc>('document_access').find({ userId: ownerUserId, role: { $in: MARKDOWN_SHARE_ROLES } }).toArray()
    : []
  const roles = new Map(invitations.map((record) => [record.documentId.toString(), record.role]))
  const filter: Filter<DocumentDoc> = {
    editorType: 'markdown', deletedAt: null,
    $or: [{ ownerUserId }, { _id: { $in: invitations.map((record) => record.documentId) } }],
  }
  return { filter, roleFor: (doc: DocumentDoc) => doc.ownerUserId?.equals(ownerUserId) ? Role.OWNER : roles.get(doc._id!.toString()) ?? null }
}
