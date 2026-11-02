import { getDB } from '../db'
import { notifyUser } from '../notifications'
import { MARKDOWN_SHARE_ROLES, markdownSharingEnabled } from '../rbac'
import type { DocumentAccessDoc, DocumentDoc } from '../types'

export async function notifyMarkdownMembers(doc: DocumentDoc, event: object) {
  const recipients = new Set<string>()
  if (doc.ownerUserId) recipients.add(doc.ownerUserId.toString())
  if (markdownSharingEnabled()) {
    const invitations = await getDB().collection<DocumentAccessDoc>('document_access').find({ documentId: doc._id!, role: { $in: MARKDOWN_SHARE_ROLES } }).toArray()
    for (const item of invitations) recipients.add(item.userId.toString())
  }
  for (const userId of recipients) notifyUser(userId, { ...event, docId: doc.docId })
}
