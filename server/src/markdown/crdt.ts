import * as Y from 'yjs'
import { getDB } from '../db'
import { toBuffer } from '../persistence'
import type { DocumentDoc } from '../types'

/** CAS ensures concurrent first-open requests use exactly one seed identity. */
export async function ensureMarkdownState(docId: string): Promise<DocumentDoc> {
  const documents = getDB().collection<DocumentDoc>('documents')
  for (let attempt = 0; attempt < 10; attempt++) {
    const doc = await documents.findOne({ docId, editorType: 'markdown', deletedAt: null })
    if (!doc) throw new Error('Document not found')
    if (toBuffer(doc.crdtState).length) {
      if (doc.markdownEpoch !== undefined) return doc
      const upgraded = await documents.findOneAndUpdate({ _id: doc._id, markdownEpoch: { $exists: false } }, { $set: { markdownEpoch: 0 } }, { returnDocument: 'after' })
      if (upgraded) return upgraded
      continue
    }
    const seed = new Y.Doc()
    seed.getText('markdown').insert(0, doc.markdown ?? '')
    const state = Buffer.from(Y.encodeStateAsUpdate(seed))
    seed.destroy()
    const updated = await documents.findOneAndUpdate({
      _id: doc._id, crdtState: doc.crdtState,
      revision: doc.revision ?? { $exists: false },
      markdownEpoch: doc.markdownEpoch ?? { $exists: false },
    }, { $set: { crdtState: state, crdtStateSize: state.length, markdownEpoch: doc.markdownEpoch ?? 0 } }, { returnDocument: 'after' })
    if (updated) return updated
  }
  throw new Error('Document changed during collaboration initialization; retry')
}
