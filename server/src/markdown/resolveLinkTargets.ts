import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import type { DocumentDoc, OutgoingLink } from '../types'
import type { MarkdownAnalysis } from './analyze'

/**
 * Resolve new wiki links by title while retaining the stable identity of links
 * that were already resolved. A document title is mutable, so resolving an
 * unchanged `[[old title]]` from scratch would otherwise break after a rename.
 */
export async function resolveLinkTargets(
  links: MarkdownAnalysis['outgoingLinks'],
  ownerId: string,
  previousLinks: OutgoingLink[] = [],
): Promise<OutgoingLink[]> {
  if (!links.length) return []
  const previousTargetIds = new Map<string, string>()
  for (const link of previousLinks) {
    if (link.targetDocId && !previousTargetIds.has(link.title)) previousTargetIds.set(link.title, link.targetDocId)
  }
  const targets = await getDB().collection<DocumentDoc>('documents').find({
    ownerUserId: new ObjectId(ownerId), editorType: 'markdown', deletedAt: null,
    $or: [
      { title: { $in: [...new Set(links.map((link) => link.title))] } },
      { docId: { $in: [...new Set(previousTargetIds.values())] } },
    ],
  }, { projection: { title: 1, docId: 1 } }).toArray()
  const ids = new Map<string, string | null>()
  const validDocIds = new Set<string>()
  for (const target of targets) {
    validDocIds.add(target.docId)
    ids.set(target.title, ids.has(target.title) ? null : target.docId)
  }
  return links.map((link) => {
    const previousTargetId = previousTargetIds.get(link.title)
    return { ...link, targetDocId: previousTargetId && validDocIds.has(previousTargetId) ? previousTargetId : ids.get(link.title) ?? null }
  })
}
