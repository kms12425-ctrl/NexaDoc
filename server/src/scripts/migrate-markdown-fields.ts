import type { Db } from 'mongodb'
import { closeDB, connectDB } from '../db'
import type { DocumentDoc } from '../types'

/** Optional, idempotent migration. Does not touch bodies, timestamps or CRDT state. */
export async function migrateMarkdownFields(db: Db) {
  const documents = db.collection<DocumentDoc>('documents')
  const editorType = await documents.updateMany({ editorType: { $exists: false } }, { $set: { editorType: 'rich' } })
  const tags = await documents.updateMany({ tags: { $exists: false } }, { $set: { tags: [] } })
  const revision = await documents.updateMany({ revision: { $exists: false } }, { $set: { revision: 0 } })
  return { editorType: editorType.modifiedCount, tags: tags.modifiedCount, revision: revision.modifiedCount }
}

async function main() {
  try {
    console.log('[migration]', await migrateMarkdownFields(await connectDB()))
  } finally {
    await closeDB()
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('[migration] Failed:', error)
    process.exitCode = 1
  })
}
