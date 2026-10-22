import type { DocumentDoc } from '../types'

export const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024

// Creation tolerates invalid entries; PATCH validates first, then shares normalization.
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim()
    const key = tag.toLocaleLowerCase()
    if (!tag || tag.length > 30 || seen.has(key)) continue
    seen.add(key)
    result.push(tag)
    if (result.length === 20) break
  }
  return result
}

export function serializeDocument(doc: DocumentDoc) {
  return {
    id: doc.docId,
    name: doc.title,
    editorType: doc.editorType ?? 'rich',
    tags: doc.tags ?? [],
    revision: doc.revision ?? 0,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
  }
}
