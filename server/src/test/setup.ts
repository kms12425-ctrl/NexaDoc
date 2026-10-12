import { MongoMemoryServer } from 'mongodb-memory-server'
import { connectDB } from '../db'

// 全局只起一个 MongoMemoryServer，所有测试文件共享
let mongoServer: MongoMemoryServer | null = null
let isSetup = false

beforeAll(async () => {
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create()
    process.env.MONGO_URI = mongoServer.getUri()
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
  }
  if (!isSetup) {
    await connectDB()
    isSetup = true
  }
}, 30000)

afterAll(async () => {
  // 不在这里 stop mongoServer，让进程退出时自然清理
})

afterEach(async () => {
  const { getDB } = await import('../db')
  const db = getDB()
  await Promise.all([
    db.collection('users').deleteMany({}),
    db.collection('documents').deleteMany({}),
    db.collection('document_access').deleteMany({}),
    db.collection('snapshots').deleteMany({}),
    db.collection('comments').deleteMany({}),
  ])
})
