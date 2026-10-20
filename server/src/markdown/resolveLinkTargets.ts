import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import type { DocumentDoc, OutgoingLink } from '../types'
import type { MarkdownAnalysis } from './analyze'

export async function resolveLinkTargets(links: MarkdownAnalysis['outgoingLinks'], ownerId: string): Promise<OutgoingLink[]> {
  if (!links.length) return []
  const targets = await getDB().collection<DocumentDoc>('documents').find({
    ownerUserId: new ObjectId(ownerId), editorType: 'markdown', deletedAt: null,
    title: { $in: [...new Set(links.map((link) => link.title))] },
  }, { projection: { title: 1, docId: 1 } }).toArray()
  const ids = new Map<string, string | null>()
  for (const target of targets) ids.set(target.title, ids.has(target.title) ? null : target.docId)
  return links.map((link) => ({ ...link, targetDocId: ids.get(link.title) ?? null }))
}
