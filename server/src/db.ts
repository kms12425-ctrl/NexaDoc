import { MongoClient, Db } from 'mongodb'

// 注意：默认值必须在这里「延迟」读取 process.env。
// 若在模块顶层固化（const X = process.env.MONGO_URI || ...），
// 由于 setup.ts 是在 beforeAll 中才注入 MongoMemoryServer 的地址，
// 测试就会连到本机 27017 的开发库（并清空它），内存库形同虚设。
const DEFAULT_MONGO_URI = 'mongodb://localhost:27017'
const DEFAULT_DB_NAME = 'nexadoc'

let dbInstance: Db | null = null
let clientInstance: MongoClient | null = null

/** Safe to run repeatedly, including against a database created before Markdown support. */
export async function ensureMarkdownIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection('documents').createIndex({ editorType: 1, updatedAt: -1 }),
    db.collection('documents').createIndex({ ownerUserId: 1, editorType: 1, updatedAt: -1 }),
    db.collection('documents').createIndex({ tags: 1 }),
    db.collection('documents').createIndex({ 'outgoingLinks.targetDocId': 1 }),
  ])
}

export async function connectDB(): Promise<Db>
{
  if (dbInstance) return dbInstance

  const uri = process.env.MONGO_URI || DEFAULT_MONGO_URI
  const dbName = process.env.DB_NAME || DEFAULT_DB_NAME

  clientInstance = new MongoClient(uri)
  await clientInstance.connect()
  dbInstance = clientInstance.db(dbName)

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
    ensureMarkdownIndexes(dbInstance),
  ])

  console.log(`[db] MongoDB connected: ${dbName}`)
  return dbInstance
}

export function getDB(): Db
{
  if (!dbInstance) throw new Error('Database not connected. Call connectDB() first.')
  return dbInstance
}

/** 关闭 MongoDB 连接（优雅退出用；不关会让容器里的进程多等数秒才被强制终止） */
export async function closeDB(): Promise<void>
{
  if (!clientInstance) return
  await clientInstance.close()
  clientInstance = null
  dbInstance = null
}
