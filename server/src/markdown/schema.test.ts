import { describe, expect, it } from 'vitest'
import { ObjectId } from 'mongodb'
import { ensureMarkdownIndexes, getDB } from '../db'
import { migrateMarkdownFields } from '../scripts/migrate-markdown-fields'
import { toBuffer } from '../persistence'
import type { DocumentDoc } from '../types'

describe('A1 Markdown indexes and optional migration', () => {
  it('creates the four indexes idempotently', async () => {
    const db = getDB()
    const before = await db.collection('documents').listIndexes().toArray()
    await ensureMarkdownIndexes(db)
    await ensureMarkdownIndexes(db)
    const after = await db.collection('documents').listIndexes().toArray()
    expect(after).toHaveLength(before.length)
    for (const key of [
      { editorType: 1, updatedAt: -1 },
      { ownerUserId: 1, editorType: 1, updatedAt: -1 },
      { tags: 1 },
      { 'outgoingLinks.targetDocId': 1 },
    ]) expect(after.some((index) => JSON.stringify(index.key) === JSON.stringify(key))).toBe(true)
  })

  it('backfills only missing fields and preserves source, CRDT state and timestamps on repeated runs', async () => {
    const db = getDB()
    const documents = db.collection<DocumentDoc>('documents')
    const base = {
      ownerUserId: new ObjectId(), title: 'Keep', crdtState: Buffer.from([1, 5, 8]),
      crdtStateSize: 3, updateCount: 6, createdAt: new Date(1000), updatedAt: new Date(2000),
    }
    await documents.insertMany([
      { ...base, docId: 'legacy' },
      { ...base, docId: 'markdown', editorType: 'markdown', tags: ['existing'], revision: 9, markdown: '# Keep', searchText: 'Keep' },
    ])
    expect(await migrateMarkdownFields(db)).toEqual({ editorType: 1, tags: 1, revision: 1 })
    expect(await migrateMarkdownFields(db)).toEqual({ editorType: 0, tags: 0, revision: 0 })
    const legacy = await documents.findOne({ docId: 'legacy' })
    expect(legacy).toMatchObject({ editorType: 'rich', tags: [], revision: 0, createdAt: base.createdAt, updatedAt: base.updatedAt, updateCount: 6 })
    expect(toBuffer(legacy?.crdtState)).toEqual(base.crdtState)
    const markdown = await documents.findOne({ docId: 'markdown' })
    expect(markdown).toMatchObject({ editorType: 'markdown', tags: ['existing'], revision: 9, markdown: '# Keep', searchText: 'Keep' })
    expect(toBuffer(markdown?.crdtState)).toEqual(base.crdtState)
  })
})
