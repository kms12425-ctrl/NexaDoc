import { MongoClient, Db } from 'mongodb'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017'
const DB_NAME = process.env.DB_NAME || 'nexadoc'

let dbInstance: Db | null = null

export async function connectDB(): Promise<Db> {
  if (dbInstance) return dbInstance

  const client = new MongoClient(MONGO_URI)
  await client.connect()
  dbInstance = client.db(DB_NAME)

  // 幂等创建索引
  await Promise.all([
    dbInstance.collection('users').createIndex({ username: 1 }, { unique: true }),
    dbInstance.collection('users').createIndex(
      { email: 1 },
      { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
    ),
    dbInstance.collection('documents').createIndex({ docId: 1 }, { unique: true }),
    dbInstance.collection('documents').createIndex({ ownerUserId: 1 }),
    dbInstance.collection('documents').createIndex({ updatedAt: -1 }),
    dbInstance.collection('document_access').createIndex(
      { documentId: 1, userId: 1 },
      { unique: true }
    ),
    dbInstance.collection('snapshots').createIndex({ documentId: 1, createdAt: -1 }),
    dbInstance.collection('comments').createIndex({ documentId: 1, createdAt: -1 }),
  ])

  console.log(`[db] MongoDB connected: ${DB_NAME}`)
  return dbInstance
}

export function getDB(): Db {
  if (!dbInstance) throw new Error('Database not connected. Call connectDB() first.')
  return dbInstance
}
