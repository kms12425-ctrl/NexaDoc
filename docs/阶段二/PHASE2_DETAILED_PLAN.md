# 阶段二详细计划：三层架构 + 持久化 + 用户系统 + RBAC

> **目标**：在阶段一（JS→TS, Quill→TipTap, Socket.IO→Yjs WS）基础上，将 `NexaDoc` 从「2 层架构 + localStorage」升级到「三层服务架构 + MongoDB 持久化 + JWT 认证 + RBAC 权限」（保留 Node.js/TypeScript 技术栈）。

---

## 目录

- [Day 0：环境准备](#day-0环境准备)
- [Phase 1 代码修改清单](#phase-1-代码修改清单)
- [Week 1：服务端三层架构](#week-1服务端三层架构)
- [Week 2：前端适配 + 版本历史 + 分享 + 评论](#week-2前端适配--版本历史--分享--评论)

---

## Day 0：环境准备

### Step 0.1 安装 MongoDB

**本地安装**（任选其一）：

```bash
# 方案 A: Docker（推荐，最快）
docker run -d -p 27017:27017 --name mongo-docs mongo:7

# 方案 B: Windows 本地安装 MongoDB Community Server
# 下载: https://www.mongodb.com/try/download/community
# 安装后默认运行在 27017 端口
```

**验证**：
```bash
# Docker 方式验证
docker exec -it mongo-docs mongosh --eval "db.runCommand({ ping: 1 })"
# 期望输出: { ok: 1 }
```

### Step 0.2 创建 .env 文件

**新建** `server/.env`：
```env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
MONGO_URI=mongodb://localhost:27017
DB_NAME=nexadoc
JWT_SECRET=dev-secret-change-in-production
```

**新建** `client/.env`：
```env
VITE_API_URL=http://localhost:3001
VITE_YJS_URL=ws://localhost:5173/yjs
```

**验证**：
```bash
# 确认 .env 不被 git 追踪
cat .gitignore | grep -E "\.env"
# 如果没有，追加 .env 到 .gitignore
```

### Step 0.3 安装新依赖

```bash
cd server && npm install mongodb bcryptjs jsonwebtoken
cd ../client && npm install
```

**验证**：
```bash
# server/node_modules 中应有 mongodb, bcryptjs, jsonwebtoken
ls server/node_modules | grep -E "mongodb|bcryptjs|jsonwebtoken"
```

### Step 0.4 验证 y-websocket v2 persistence API

在写持久化层前，先确认 `y-websocket@2.0.4` 的 `setupWSConnection` 是否支持 `persistence` 参数：

```bash
cat node_modules/y-websocket/src/y-websocket.d.ts | grep -A5 "setupWSConnection"
# 或查看源码
cat node_modules/y-websocket/src/y-websocket.js | grep -A20 "function setupWSConnection"
```

**预期结果**：`setupWSConnection(conn, req, options)` 第三参数 `options` 中支持 `persistence` 字段，包含 `bindState(docName, ydoc)` 和 `writeState(docName, ydoc)` 两个异步方法。

> 如果 v2 不支持 `persistence` 选项，回退方案：在 `wss.on('connection')` 中手动调用 `bindState` + `writeState`，不依赖 `setupWSConnection` 的 `persistence` 参数。

---

## Phase 1 代码修改清单

阶段一已完成的核心变更（TipTap 迁移、Yjs WebSocket、TypeScript）**正确且可保留**。以下文件需要修改或扩展：

### 1.1 需要修改的现有文件（9 个）

| # | 文件 | 当前行数 | 修改内容 |
|---|---|---|---|
| 1 | `server/src/server.ts` | 86 行 | 单进程 Express+Yjs WS → 三层架构（Express API + MongoDB 持久化 + JWT） |
| 2 | `server/package.json` | 31 行 | 新增 `mongodb`, `bcryptjs`, `jsonwebtoken` |
| 3 | `client/src/services/storage.ts` | 15 行 | 纯 localStorage → API 调用 + localStorage 降级缓存 |
| 4 | `client/src/types/index.ts` | 57 行 | 扩展 `User`, `Role`, `SnapshotMeta`, `DocumentAccess`；`DocumentAbilities` 正式启用 |
| 5 | `client/src/components/DocsPage.tsx` | 279 行 | 从 `getDocs()` 改为 `api.listDocuments()` |
| 6 | `client/src/components/Editor.tsx` | 464 行 | 随机用户名 → AuthContext 用户；标题保存 → API；新增版本历史入口 |
| 7 | `client/src/App.tsx` | 14 行 | 新增 `/login`, `/register` 路由 + `ProtectedRoute` |
| 8 | `client/src/services/yjsProvider.ts` | 66 行 | `customUser` 从可选改为必传；WS_URL 用 `VITE_YJS_URL` |
| 9 | `client/vite.config.ts` | 18 行 | 新增 `/api` HTTP 代理 |

### 1.2 可保留不动的文件

| 文件 | 原因 |
|---|---|
| `client/src/components/EditorToolbar.tsx` | 纯 UI 组件，不涉及数据层 |
| `client/src/extensions/FontSize.ts` | 自定义 TipTap 扩展，与架构无关 |
| `client/src/utils/generateId.ts` | ID 生成工具 |
| `client/src/index.css` | 样式不变 |
| `client/tsconfig.json` / `tsconfig.node.json` | TS 配置不变 |
| `server/tsconfig.json` | TS 配置不变 |
| `client/src/main.tsx` | 保持无 StrictMode |

### 1.3 需要新建的文件（18 个）

**服务端 (server/src/)**
| # | 文件 | 用途 |
|---|---|---|
| A1 | `server/src/db.ts` | MongoDB 连接 + 索引初始化 |
| A2 | `server/src/persistence.ts` | Yjs 文档持久化层 |
| A3 | `server/src/types.ts` | `UserDoc`, `DocumentDoc`, `SnapshotDoc`, `DocumentAccessDoc`, `CommentDoc` |
| A4 | `server/src/auth.ts` | JWT 认证 + 注册/登录接口 + `requireAuth` 中间件 |
| A5 | `server/src/rbac.ts` | `Role`, `LinkReach`, `getAbilities()` |
| A6 | `server/src/routes/documents.ts` | 文档 CRUD 路由 |
| A7 | `server/src/routes/snapshots.ts` | 版本历史路由 |
| A8 | `server/src/routes/sharing.ts` | 分享/邀请路由 |
| A9 | `server/src/routes/comments.ts` | 评论路由 |

**客户端 (client/src/)**
| # | 文件 | 用途 |
|---|---|---|
| B1 | `client/src/services/api.ts` | REST API 客户端封装 |
| B2 | `client/src/contexts/AuthContext.tsx` | 认证上下文 + `useAuth()` |
| B3 | `client/src/components/LoginPage.tsx` | 登录页 |
| B4 | `client/src/components/RegisterPage.tsx` | 注册页 |
| B5 | `client/src/components/VersionHistoryModal.tsx` | 版本历史模态框 |
| B6 | `client/src/components/ShareModal.tsx` | 分享/权限管理 |
| B7 | `client/src/components/CommentPanel.tsx` | 侧边评论面板 |

---

## Week 1：服务端三层架构

### Day 1：MongoDB 连接 + 类型定义

#### Step 1.1 新建 `server/src/types.ts`

```typescript
import type { ObjectId } from 'mongodb'

// ── 用户文档 ──
export interface UserDoc {
  _id: ObjectId
  username: string
  email: string
  passwordHash: string
  displayName: string
  avatarColor: string
  createdAt: Date
  updatedAt: Date
}

// ── 文档文档 ──
export interface DocumentDoc {
  _id: ObjectId
  docId: string               // Yjs room name，用作 WebSocket 路由 key
  title: string
  ownerUserId: ObjectId | null  // 阶段二：创建文档时设为当前用户
  parentId?: string | null        // 文档树结构（阶段六启用）
  deletedAt?: Date | null         // 软删除时间戳（阶段六启用）
  crdtState: Buffer              // Y.encodeStateAsUpdate(doc) 二进制
  crdtStateSize: number
  updateCount: number
  createdAt: Date
  updatedAt: Date
}

// ── 文档访问权限 ──
export interface DocumentAccessDoc {
  _id: ObjectId
  documentId: ObjectId
  userId: ObjectId
  role: Role                  // 引用 rbac.ts 的 Role
  invitedAt: Date
  acceptedAt: Date | null
}

// ── 版本快照 ──
export interface SnapshotDoc {
  _id: ObjectId
  documentId: ObjectId
  name: string
  crdtState: Buffer
  crdtStateSize: number
  authorUserId: ObjectId | null
  authorName: string
  preview: string            // 前 120 字符
  createdAt: Date
}

// ── 评论 ──
export interface CommentDoc {
  _id: ObjectId
  documentId: ObjectId
  userId: ObjectId
  authorName: string
  body: string
  resolved: boolean
  createdAt: Date
  updatedAt: Date
}
```

> **注意**：`DocumentAccessDoc` 引用了 `Role` 类型，需要在文件顶部 `import type { Role } from './rbac'`（Day 2 创建 rbac.ts 后）。为避免循环引用，可将 `Role` 类型定义在 `types.ts` 中，`rbac.ts` 从 `types.ts` 导入。

**修订**：将 `Role` 和 `LinkReach` 定义在 `types.ts` 中，`rbac.ts` 从 `types.ts` 导入，避免循环依赖。

**验证**：`cd server && npx tsc --noEmit`（此时会报 `rbac.ts` 不存在的错误，Day 2 修复）。

---

#### Step 1.2 新建 `server/src/db.ts`

```typescript
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
    dbInstance.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
    dbInstance.collection('documents').createIndex({ docId: 1 }, { unique: true }),
    dbInstance.collection('documents').createIndex({ ownerUserId: 1 }),
    dbInstance.collection('documents').createIndex({ updatedAt: -1 }),
    dbInstance.collection('document_access').createIndex({ documentId: 1, userId: 1 }, { unique: true }),
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
```

**验证**：
```bash
# 临时在 server.ts 顶部加 connectDB() 调用，启动服务端
cd server && npx ts-node src/server.ts
# 期望日志: [db] MongoDB connected: nexadoc
# 用 mongosh 验证索引:
docker exec -it mongo-docs mongosh nexadoc --eval "db.documents.getIndexes()"
```

---

#### Step 1.3 新建 `server/src/persistence.ts`

```typescript
import * as Y from 'yjs'
import { getDB } from './db'
import type { DocumentDoc } from './types'

const DEBOUNCE_MS = 1000
const timers = new Map<string, NodeJS.Timeout>()

/**
 * Yjs 持久化层——处理文档加载与变更持久化。
 * y-websocket v2 的 setupWSConnection 第三参数 options.persistence
 * 需要提供 bindState(docName, ydoc) 和 writeState(docName, ydoc)。
 */
export const mongoPersistence = {
  async bindState(docName: string, ydoc: Y.Doc): Promise<void> {
    const db = getDB()
    const existing = await db.collection<DocumentDoc>('documents').findOne({ docId: docName })

    if (existing?.crdtState && existing.crdtState.length > 0) {
      Y.applyUpdate(ydoc, new Uint8Array(existing.crdtState.buffer))
    } else {
      // 新文档——创建 MongoDB 记录
      await db.collection<DocumentDoc>('documents').insertOne({
        docId: docName,
        title: docName === 'default' ? 'Untitled Document' : docName,
        ownerUserId: null,
        crdtState: Buffer.alloc(0),
        crdtStateSize: 0,
        updateCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      // 只持久化本地变更，避免远程同步回环
      scheduleSave(docName, ydoc)
    })
  },

  async writeState(docName: string, ydoc: Y.Doc): Promise<void> {
    const t = timers.get(docName)
    if (t) { clearTimeout(t); timers.delete(docName) }
    await saveImmediate(docName, ydoc)
  },
}

function scheduleSave(docName: string, ydoc: Y.Doc): void {
  const existing = timers.get(docName)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => { saveImmediate(docName, ydoc); timers.delete(docName) }, DEBOUNCE_MS)
  timers.set(docName, timer)
}

async function saveImmediate(docName: string, ydoc: Y.Doc): Promise<void> {
  const db = getDB()
  const state = Y.encodeStateAsUpdate(ydoc)
  const buf = Buffer.from(state)

  await db.collection<DocumentDoc>('documents').updateOne(
    { docId: docName },
    {
      $set: { crdtState: buf, crdtStateSize: buf.length, updatedAt: new Date() },
      $inc: { updateCount: 1 },
      $setOnInsert: { title: 'Untitled Document', ownerUserId: null, createdAt: new Date() },
    },
    { upsert: true }
  )
}
```

**验证**：
```bash
# 集成到 server.ts 后，打开编辑器编辑文档
# 等 1 秒后查看 MongoDB:
docker exec -it mongo-docs mongosh nexadoc --eval "db.documents.find().toArray()"
# 期望: crdtState 字段有二进制数据，updateCount > 0
# 重启 server，再次打开同一文档 → 内容不丢失
```

---

### Day 2：RBAC 权限模型 + JWT 认证

#### Step 2.1 在 `server/src/types.ts` 中添加 Role/LinkReach 类型

在 `types.ts` 顶部添加（替代 Step 1.1 中引用 `rbac.ts` 的设计）：

```typescript
// ── RBAC 角色 ──
export const Role = {
  READER: 'reader',
  COMMENTER: 'commenter',
  EDITOR: 'editor',
  ADMIN: 'administrator',
  OWNER: 'owner',
} as const
export type Role = typeof Role[keyof typeof Role]

// ── 链接可见性 ──
export const LinkReach = {
  RESTRICTED: 'restricted',
  AUTHENTICATED: 'authenticated',
  PUBLIC: 'public',
} as const
export type LinkReach = typeof LinkReach[keyof typeof LinkReach]
```

**验证**：`npx tsc --noEmit` 无错误。

---

#### Step 2.2 新建 `server/src/rbac.ts`

```typescript
import { Role, LinkReach } from './types'
export { Role, LinkReach }

// 权限层级：owner > admin > editor > commenter > reader
const ROLE_PRIORITY: Record<Role, number> = {
  [Role.OWNER]: 5,
  [Role.ADMIN]: 4,
  [Role.EDITOR]: 3,
  [Role.COMMENTER]: 2,
  [Role.READER]: 1,
}

/**
 * 根据用户在文档上的角色返回能力契约。
 * 前端 UI 直接消费这些布尔值决定按钮/操作的显示与隐藏。
 */
export function getAbilities(role: Role | null): {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canShare: boolean
  canComment: boolean
  canViewHistory: boolean
} {
  if (!role) {
    return {
      canView: true, canEdit: false, canDelete: false,
      canShare: false, canComment: false, canViewHistory: false,
    }
  }

  const isOwner = role === Role.OWNER
  const isAdmin = role === Role.ADMIN
  const isEditor = role === Role.EDITOR
  const isCommenter = role === Role.COMMENTER

  return {
    canView: true,
    canEdit: isOwner || isAdmin || isEditor,
    canDelete: isOwner || isAdmin,
    canShare: isOwner || isAdmin,
    canComment: isOwner || isAdmin || isEditor || isCommenter,
    canViewHistory: isOwner || isAdmin || isEditor,
  }
}

/** 检查某角色是否能操作目标角色（用于权限委派） */
export function canManageRole(role: Role, target: Role): boolean {
  return ROLE_PRIORITY[role] >= ROLE_PRIORITY[target]
}
```

**验证**：
```bash
# 临时在 server.ts 中加 console.log(getAbilities(Role.OWNER)) 验证输出
cd server && npx ts-node -e "const {getAbilities, Role} = require('./src/rbac'); console.log(JSON.stringify(getAbilities(Role.OWNER)))"
# 期望: {"canView":true,"canEdit":true,"canDelete":true,"canShare":true,"canComment":true,"canViewHistory":true}
```

---

#### Step 2.3 新建 `server/src/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDB } from './db'
import type { UserDoc } from './types'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = '7d'

export interface AuthRequest extends Request {
  user?: { id: string; username: string; displayName: string }
}

// ── 注册 ──
export async function register(req: Request, res: Response) {
  const { username, password, email } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }
  if (username.length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const db = getDB()
  const existing = await db.collection<UserDoc>('users').findOne({ username })
  if (existing) return res.status(409).json({ error: 'Username already exists' })

  const passwordHash = await bcrypt.hash(password, 10)
  const colors = ['#4285f4','#ea4335','#34a853','#fbbc04','#ff6d00','#aa00ff']
  const now = new Date()
  const doc: UserDoc = {
    _id: undefined as any,
    username,
    email: email || '',
    passwordHash,
    displayName: username,
    avatarColor: colors[Math.floor(Math.random() * colors.length)],
    createdAt: now,
    updatedAt: now,
  }
  const result = await db.collection<UserDoc>('users').insertOne(doc)
  const token = jwt.sign({ id: result.insertedId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  res.status(201).json({ token, user: { id: result.insertedId, username, displayName: username } })
}

// ── 登录 ──
export async function login(req: Request, res: Response) {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  const db = getDB()
  const user = await db.collection<UserDoc>('users').findOne({ username })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  res.json({ token, user: { id: user._id, username: user.username, displayName: user.displayName } })
}

// ── JWT 验证中间件 ──
export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { id: string; username: string }
    req.user = { id: payload.id, username: payload.username, displayName: payload.username }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

**验证**：
```bash
# 注册
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123456"}'
# 期望: {"token":"...","user":{"id":"...","username":"alice","displayName":"alice"}}

# 登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123456"}'
# 期望: 同上

# 验证 JWT
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"alice","password":"123456"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token)")
curl http://localhost:3001/api/auth/me -H "Authorization: Bearer $TOKEN"
# 期望: {"user":{"id":"...","username":"alice","displayName":"alice"}}

# 错误情况：重复注册
curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d '{"username":"alice","password":"123456"}'
# 期望: {"error":"Username already exists"}
```

---

### Day 3：文档 CRUD REST API

#### Step 3.1 修改 `server/src/server.ts` — 集成 DB + Auth + 路由

**完整重写** `server/src/server.ts`：

```typescript
import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import { WebSocketServer } from 'ws'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setupWSConnection } = require('y-websocket/bin/utils')

import { connectDB } from './db'
import { mongoPersistence } from './persistence'
import { register, login, requireAuth, AuthRequest } from './auth'
import documentsRouter from './routes/documents'
import snapshotsRouter from './routes/snapshots'
import sharingRouter from './routes/sharing'
import commentsRouter from './routes/comments'

const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const app = express()

app.use(cors({ origin: CLIENT_ORIGIN, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }))
app.use(express.json())

/* ── Health ── */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

/* ── Auth routes ── */
app.post('/api/auth/register', register)
app.post('/api/auth/login', login)
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user })
})

/* ── REST API routes ── */
app.use('/api/documents', requireAuth, documentsRouter)
app.use('/api/snapshots', requireAuth, snapshotsRouter)
app.use('/api/documents', sharingRouter)     // /api/documents/:docId/share, /api/documents/:docId/access
app.use('/api/documents', commentsRouter)      // /api/documents/:docId/comments

/* ── Yjs WebSocket ── */
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true })

wss.on('connection', (ws, req) => {
  // Day 5: 在此处加 token 验证（见 Step 5.1）
  setupWSConnection(ws, req, { persistence: mongoPersistence })
})

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '/', 'http://x').pathname
  if (pathname.startsWith('/yjs')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }
})

/* ── Start ── */
async function start() {
  await connectDB()
  server.listen(PORT, () => {
    console.log(`[server] Running on http://localhost:${PORT}`)
    console.log(`[server] Accepting connections from: ${CLIENT_ORIGIN}`)
  })
}
start()

/* ── Graceful shutdown ── */
function shutdown(signal: string) {
  console.log(`\n[server] Received ${signal}. Shutting down…`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

**验证**：
```bash
cd server && npx tsc --noEmit  # 编译无错误
npm run dev                   # 启动，期望 [db] MongoDB connected
```

---

#### Step 3.2 新建 `server/src/routes/documents.ts`

```typescript
import { Router, Request, Response } from 'express'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import { getAbilities, Role } from '../rbac'
import type { DocumentDoc } from '../types'

const router = Router()

/**
 * GET /api/documents
 * 返回当前用户拥有的文档列表（软删除的排除）
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const docs = await db.collection<DocumentDoc>('documents')
    .find({ ownerUserId: req.user!.id, deletedAt: null }, { projection: { crdtState: 0 } })
    .sort({ updatedAt: -1 })
    .toArray()

  res.json(docs.map(d => ({
    ...d,
    abilities: getAbilities(Role.OWNER),
  })))
})

/**
 * POST /api/documents
 * 创建新文档，ownerUserId 设为当前用户
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const name = (req.body.name || 'Untitled Document').trim()
  const docId = name.replace(/\s+/g, '-') + '-' + Date.now()
  const now = new Date()

  const doc: DocumentDoc = {
    _id: undefined as any,
    docId,
    title: name,
    ownerUserId: req.user!.id as any,
    deletedAt: null,
    crdtState: Buffer.alloc(0),
    crdtStateSize: 0,
    updateCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  const result = await db.collection<DocumentDoc>('documents').insertOne(doc)
  res.status(201).json({ ...doc, _id: result.insertedId, abilities: getAbilities(Role.OWNER) })
})

/**
 * GET /api/documents/:docId/metadata
 */
router.get('/:docId/metadata', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne(
    { docId: req.params.docId },
    { projection: { crdtState: 0 } }
  )
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  // 检查权限：owner 或 document_access 中有记录
  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = isOwner ? Role.OWNER : (
    (await db.collection('document_access').findOne({ documentId: doc._id, userId: req.user!.id }))?.role || null
  )

  res.json({ ...doc, abilities: getAbilities(access as Role) })
})

/**
 * PATCH /api/documents/:docId/metadata
 * 更新文档标题（仅 owner/admin）
 */
router.patch('/:docId/metadata', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = await db.collection('document_access').findOne({ documentId: doc._id, userId: req.user!.id })
  const role = isOwner ? Role.OWNER : (access?.role as Role || null)
  const abilities = getAbilities(role)
  if (!abilities.canEdit) return res.status(403).json({ error: 'Insufficient permissions' })

  await db.collection<DocumentDoc>('documents').updateOne(
    { docId: req.params.docId },
    { $set: { title: req.body.title, updatedAt: new Date() } }
  )
  res.json({ status: 'ok' })
})

/**
 * DELETE /api/documents/:docId
 * 软删除文档（仅 owner/admin）
 */
router.delete('/:docId', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = await db.collection('document_access').findOne({ documentId: doc._id, userId: req.user!.id })
  const role = isOwner ? Role.OWNER : (access?.role as Role || null)
  const abilities = getAbilities(role)
  if (!abilities.canDelete) return res.status(403).json({ error: 'Insufficient permissions' })

  await db.collection<DocumentDoc>('documents').updateOne(
    { docId: req.params.docId },
    { $set: { deletedAt: new Date() } }
  )
  res.json({ status: 'ok' })
})

export default router
```

**验证**：
```bash
# 先登录拿 token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"alice","password":"123456"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token)")

# 创建文档
curl -X POST http://localhost:3001/api/documents -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"My First Doc"}'
# 期望: {"docId":"My-First-Doc-...","title":"My First Doc",...,"abilities":{...}}

# 列出文档
curl http://localhost:3001/api/documents -H "Authorization: Bearer $TOKEN"
# 期望: 返回包含刚创建的文档

# 更新标题
curl -X PATCH http://localhost:3001/api/documents/MY-First-Doc-XXXX/metadata -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Updated Title"}'

# 软删除
curl -X DELETE http://localhost:3001/api/documents/MY-First-Doc-XXXX -H "Authorization: Bearer $TOKEN"

# 验证 MongoDB
docker exec -it mongo-docs mongosh nexadoc --eval "db.documents.find({deletedAt: {\$ne: null}})"
```

---

### Day 4：版本历史 + 分享 + 评论路由

#### Step 4.1 新建 `server/src/routes/snapshots.ts`

```typescript
import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import type { SnapshotDoc } from '../types'

const router = Router()

/**
 * GET /api/snapshots/:docId/snapshots
 * 注意：路由挂载在 /api/snapshots 下，所以路径是 /api/snapshots/:docId/snapshots
 * 或者改为 /api/documents/:docId/snapshots（挂载在 /api/documents 下）
 */
// 本路由挂载在 /api/documents 下
router.get('/:docId/snapshots', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const doc = await db.collection('documents').findOne({ docId: req.params.docId })
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  const snapshots = await db.collection<SnapshotDoc>('snapshots')
    .find({ documentId: doc._id }, { projection: { crdtState: 0 } })
    .sort({ createdAt: -1 })
    .toArray()
  res.json(snapshots)
})

router.post('/:docId/snapshots', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const doc = await db.collection('documents').findOne({ docId: req.params.docId })
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  const state = doc.crdtState
  const result = await db.collection<SnapshotDoc>('snapshots').insertOne({
    documentId: doc._id,
    name: req.body.name || `Revision ${Date.now()}`,
    crdtState: state,
    crdtStateSize: state.length,
    authorUserId: req.user!.id as any,
    authorName: req.user!.username,
    preview: req.body.preview || '',
    createdAt: new Date(),
  })
  res.status(201).json({ status: 'ok', id: result.insertedId })
})

// 挂载在 /api/snapshots 下
router.post('/snapshots/:snapshotId/restore', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const snap = await db.collection<SnapshotDoc>('snapshots').findOne({
    _id: new ObjectId(req.params.snapshotId),
  })
  if (!snap) return res.status(404).json({ error: 'Snapshot not found' })
  res.json({ crdtState: Array.from(new Uint8Array(snap.crdtState.buffer)) })
})
```

> **注意路由挂载问题**：`snapshots.ts` 中 `/:docId/snapshots` 和 `/snapshots/:snapshotId/restore` 的前缀不同。需要在 `server.ts` 中分别挂载：
> - `app.use('/api/documents', snapshotsRouter)` 处理 `/:docId/snapshots`
> - 或者将 restore 路由放在单独的路由器中，挂载在 `/api/snapshots`

**修正后的 server.ts 挂载方式**：
```typescript
import snapshotsRouter from './routes/snapshots'
// snapshotsRouter 同时包含 /:docId/snapshots 和 /snapshots/:snapshotId/restore
// 但前者需要 /api/documents 前缀，后者需要 /api/snapshots 前缀
// 方案：拆为两个 router，或者统一用 /api/documents/:docId/snapshots + /api/documents/:docId/snapshots/:snapshotId/restore
```

> 为避免路径混乱，**统一所有快照路由在 `/api/documents/:docId/snapshots` 下**，restore 改为 `POST /api/documents/:docId/snapshots/:snapshotId/restore`。

**验证**：
```bash
# 创建快照
curl -X POST http://localhost:3001/api/documents/MY-First-Doc-XXXX/snapshots \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"v1","preview":"First paragraph"}'

# 列出快照
curl http://localhost:3001/api/documents/MY-First-Doc-XXXX/snapshots -H "Authorization: Bearer $TOKEN"

# 恢复快照
curl -X POST http://localhost:3001/api/documents/MY-First-Doc-XXXX/snapshots/SNAP_ID/restore -H "Authorization: Bearer $TOKEN"
```

---

#### Step 4.2 新建 `server/src/routes/sharing.ts`

```typescript
import { Router } from 'express'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import { Role } from '../rbac'
import type { DocumentAccessDoc, UserDoc } from '../types'

const router = Router()

// GET /api/documents/:docId/access — 列出协作者
router.get('/:docId/access', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const doc = await db.collection('documents').findOne({ docId: req.params.docId })
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  const access = await db.collection<DocumentAccessDoc>('document_access')
    .find({ documentId: doc._id }).toArray()

  // 关联用户信息
  const userIds = access.map(a => a.userId)
  const users = await db.collection<UserDoc>('users')
    .find({ _id: { $in: userIds } }).toArray()
  const userMap = new Map(users.map(u => [u._id.toString(), u]))

  res.json(access.map(a => ({
    ...a,
    username: userMap.get(a.userId.toString())?.username || 'unknown',
  })))
})

// POST /api/documents/:docId/share — 邀请协作者
router.post('/:docId/share', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const doc = await db.collection('documents').findOne({ docId: req.params.docId })
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  // 权限检查：只有 owner/admin 可以分享
  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = await db.collection<DocumentAccessDoc>('document_access')
    .findOne({ documentId: doc._id, userId: req.user!.id })
  const role = isOwner ? Role.OWNER : (access?.role as Role || null)
  if (role !== Role.OWNER && role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Only owner/admin can share' })
  }

  const targetUser = await db.collection<UserDoc>('users').findOne({ username: req.body.username })
  if (!targetUser) return res.status(404).json({ error: 'User not found' })

  const targetRole = req.body.role || Role.READER
  await db.collection<DocumentAccessDoc>('document_access').updateOne(
    { documentId: doc._id, userId: targetUser._id },
    { $set: { role: targetRole, invitedAt: new Date(), acceptedAt: new Date() } },
    { upsert: true }
  )
  res.json({ status: 'ok' })
})

// DELETE /api/documents/:docId/access/:userId — 移除协作者
router.delete('/:docId/access/:userId', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const doc = await db.collection('documents').findOne({ docId: req.params.docId })
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  if (!isOwner) return res.status(403).json({ error: 'Only owner can remove collaborators' })

  await db.collection<DocumentAccessDoc>('document_access').deleteOne({
    documentId: doc._id,
    userId: new (require('mongodb').ObjectId)(req.params.userId),
  })
  res.json({ status: 'ok' })
})

export default router
```

**验证**：
```bash
# 注册第二个用户 bob
curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d '{"username":"bob","password":"123456"}'

# alice 分享给 bob
TOKEN_ALICE=...  # alice 的 token
curl -X POST http://localhost:3001/api/documents/MY-First-Doc-XXXX/share \
  -H "Authorization: Bearer $TOKEN_ALICE" -H "Content-Type: application/json" \
  -d '{"username":"bob","role":"editor"}'

# 查看协作者列表
curl http://localhost:3001/api/documents/MY-First-Doc-XXXX/access -H "Authorization: Bearer $TOKEN_ALICE"
# 期望: 包含 bob (editor) 和 alice (owner, 如果有记录)
```

---

#### Step 4.3 新建 `server/src/routes/comments.ts`

```typescript
import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import type { CommentDoc } from '../types'

const router = Router()

// GET /api/documents/:docId/comments
router.get('/:docId/comments', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const comments = await db.collection<CommentDoc>('comments')
    .find({ documentId: new ObjectId(req.params.docId) }, { projection: {} })
    .sort({ createdAt: -1 })
    .toArray()
  res.json(comments)
})

// POST /api/documents/:docId/comments
router.post('/:docId/comments', async (req: AuthRequest, res: any) => {
  const db = getDB()
  if (!req.body.body?.trim()) return res.status(400).json({ error: 'Comment body required' })

  const now = new Date()
  const result = await db.collection<CommentDoc>('comments').insertOne({
    documentId: new ObjectId(req.params.docId),
    userId: req.user!.id as any,
    authorName: req.user!.username,
    body: req.body.body,
    resolved: false,
    createdAt: now,
    updatedAt: now,
  })
  res.status(201).json({ status: 'ok', id: result.insertedId })
})

// PATCH /api/comments/:commentId/resolve
router.patch('/comments/:commentId/resolve', async (req: AuthRequest, res: any) => {
  const db = getDB()
  await db.collection<CommentDoc>('comments').updateOne(
    { _id: new ObjectId(req.params.commentId) },
    { $set: { resolved: true, updatedAt: new Date() } }
  )
  res.json({ status: 'ok' })
})

export default router
```

> **注意**：`comments.ts` 的 `/:docId/comments` 和 `/comments/:commentId/resolve` 两个前缀不同，与 `sharing.ts` 类似。统一策略：所有评论路由放在 `/api/documents/:docId/comments` 下，resolve 改为 `PATCH /api/documents/:docId/comments/:commentId/resolve`。

**验证**：
```bash
# 添加评论
curl -X POST http://localhost:3001/api/documents/MY-First-Doc-XXXX/comments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"body":"This is a comment"}'

# 列出评论
curl http://localhost:3001/api/documents/MY-First-Doc-XXXX/comments -H "Authorization: Bearer $TOKEN"
```

---

### Day 4 末尾：路由统一整理

**修正 `server.ts` 中的路由挂载**——为了避免多个路由器的路径前缀冲突，使用以下策略：

```typescript
// 所有文档子路由统一挂在 /api/documents 下
// documents.ts 包含: GET /, POST /, GET/PATCH/DELETE /:docId/metadata, DELETE /:docId
// sharing.ts 包含: GET/POST /:docId/access, DELETE /:docId/access/:userId
// comments.ts 包含: GET/POST /:docId/comments, PATCH /:docId/comments/:commentId/resolve
// snapshots.ts 包含: GET/POST /:docId/snapshots, POST /:docId/snapshots/:snapshotId/restore

app.use('/api/documents', requireAuth, documentsRouter)
app.use('/api/documents', sharingRouter)
app.use('/api/documents', commentsRouter)
app.use('/api/documents', snapshotsRouter)
// snapshots 的 restore 路径: /api/documents/:docId/snapshots/:snapshotId/restore ✓
// comments 的 resolve 路径: /api/documents/:docId/comments/:commentId/resolve ✓
```

**Day 4 检查点**：
```bash
cd server && npx tsc --noEmit && echo "✓ TypeScript 编译通过"
npm run dev
# 逐个 curl 测试所有 API 端点（见上面各 Step 的验证命令）
```

---

### Day 5：WebSocket 层认证 + 协作权限

#### Step 5.1 修改 `server/src/server.ts` 的 WebSocket 连接处理

当前 `wss.on('connection')` 无认证。需从 URL query 参数提取 JWT token 并验证权限：

```typescript
import jwt from 'jsonwebtoken'
import { Role } from './rbac'

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url || '/', 'http://x')
  const token = url.searchParams.get('token')

  if (!token) {
    ws.close(4001, 'No token')
    return
  }

  let payload: { id: string; username: string }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-in-production') as any
  } catch {
    ws.close(4001, 'Invalid token')
    return
  }

  // 检查用户对该文档的访问权限
  const docId = url.pathname.replace('/yjs/', '')
  const db = getDB()
  const doc = await db.collection('documents').findOne({ docId })
  if (!doc) {
    // 新文档——允许创建者连接
    // （bindState 会自动创建 MongoDB 记录，但 ownerUserId 在此处未知）
    // 阶段二简化：如果文档不存在且用户已认证，允许连接
  } else {
    const isOwner = doc.ownerUserId?.toString() === payload.id
    const access = await db.collection('document_access').findOne({
      documentId: doc._id,
      userId: new (require('mongodb').ObjectId)(payload.id),
    })
    if (!isOwner && !access) {
      ws.close(4003, 'No access to this document')
      return
    }
  }

  setupWSConnection(ws, req, { persistence: mongoPersistence })
})
```

#### Step 5.2 修改 `client/src/services/yjsProvider.ts` — 传递 token

当前 `WS_URL` 不含 token。改为从 localStorage 读取 token 并附加到 WebSocket URL：

```typescript
// 开发环境通过 Vite 代理连接
function getWsUrl(): string {
  const base = import.meta.env.VITE_YJS_URL || 'ws://localhost:5173/yjs'
  const token = localStorage.getItem('token')
  if (!token) return base  // 阶段一兼容（无认证时仍可连接）
  return `${base}?token=${encodeURIComponent(token)}`
}

export function createYjs(
  docId: string,
  customUser: Partial<UserAwareness>
): CollabSession {
  const ydoc = new Y.Doc()
  const persistence = new IndexeddbPersistence(docId, ydoc)
  const provider = new WebsocketProvider(getWsUrl(), docId, ydoc)

  // ... 其余不变
}
```

> **注意**：`customUser` 改为必传（去掉 `?`），因为认证系统上线后随机用户名不再有意义。

**验证**：
```bash
# 登录后在浏览器中打开编辑器
# 浏览器 DevTools → Network → WS → 应看到 ws://localhost:5173/yjs/DOC_ID?token=...
# 连接状态应为 "Connected"
# 编辑内容 → 另一标签页（同账号或其他有权限的账号）实时同步
```

**Day 5 检查点 — Week 1 完整验证**：
```bash
# 1. MongoDB 持久化
docker exec -it mongo-docs mongosh nexadoc --eval "db.documents.countDocuments()"
# 2. JWT 认证
curl http://localhost:3001/api/auth/me -H "Authorization: Bearer $TOKEN"
# 3. 文档 CRUD
curl http://localhost:3001/api/documents -H "Authorization: Bearer $TOKEN"
# 4. 协作权限（无权限的文档返回 403）
# 5. 浏览器：注册 → 登录 → 创建文档 → 编辑 → 重启服务端 → 内容保留 → 两个标签同步
```

---

## Week 2：前端适配 + 版本历史 + 分享 + 评论

### Day 6：前端 API 客户端 + AuthContext

#### Step 6.1 扩展 `client/src/types/index.ts`

在现有文件**末尾**追加：

```typescript
// ── 用户信息（从 API 返回）──
export interface User {
  id: string
  username: string
  displayName: string
  avatarColor: string
}

// ── RBAC 角色（与 server/src/types.ts 的 Role 保持一致）──
export const Role = {
  READER: 'reader',
  COMMENTER: 'commenter',
  EDITOR: 'editor',
  ADMIN: 'administrator',
  OWNER: 'owner',
} as const
export type Role = typeof Role[keyof typeof Role]

// ── 版本快照元数据 ──
export interface SnapshotMeta {
  _id: string
  name: string
  authorName: string
  preview: string
  createdAt: number
}

// ── 文档访问记录 ──
export interface DocumentAccess {
  _id: string
  userId: string
  username: string
  role: Role
  invitedAt: number
  acceptedAt: number | null
}

// ── 评论 ──
export interface Comment {
  _id: string
  documentId: string
  userId: string
  authorName: string
  body: string
  resolved: boolean
  createdAt: number
  updatedAt: number
}
```

**验证**：`cd client && npx tsc --noEmit`

---

#### Step 6.2 新建 `client/src/services/api.ts`

```typescript
import type { DocumentMeta, User, SnapshotMeta, DocumentAccess, Comment } from '../types'

const API_URL = import.meta.env.VITE_API_URL || ''

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // ── Auth ──
  register: (username: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ user: User }>('/api/auth/me'),

  // ── Documents ──
  listDocuments: () => request<DocumentMeta[]>('/api/documents'),
  createDocument: (name: string) =>
    request<DocumentMeta>('/api/documents', { method: 'POST', body: JSON.stringify({ name }) }),
  updateDocumentTitle: (docId: string, title: string) =>
    request<{ status: string }>(`/api/documents/${docId}/metadata`, {
      method: 'PATCH', body: JSON.stringify({ title }),
    }),
  deleteDocument: (docId: string) =>
    request<{ status: string }>(`/api/documents/${docId}`, { method: 'DELETE' }),
  getDocumentMeta: (docId: string) =>
    request<DocumentMeta & { abilities: any }>(`/api/documents/${docId}/metadata`),

  // ── Snapshots ──
  listSnapshots: (docId: string) =>
    request<SnapshotMeta[]>(`/api/documents/${docId}/snapshots`),
  createSnapshot: (docId: string, name: string, preview: string) =>
    request<{ status: string; id: string }>(`/api/documents/${docId}/snapshots`, {
      method: 'POST', body: JSON.stringify({ name, preview }),
    }),
  restoreSnapshot: (docId: string, snapshotId: string) =>
    request<{ crdtState: number[] }>(`/api/documents/${docId}/snapshots/${snapshotId}/restore`),

  // ── Sharing ──
  listAccess: (docId: string) =>
    request<DocumentAccess[]>(`/api/documents/${docId}/access`),
  shareDocument: (docId: string, username: string, role: string) =>
    request<{ status: string }>(`/api/documents/${docId}/share`, {
      method: 'POST', body: JSON.stringify({ username, role }),
    }),
  removeAccess: (docId: string, userId: string) =>
    request<{ status: string }>(`/api/documents/${docId}/access/${userId}`, { method: 'DELETE' }),

  // ── Comments ──
  listComments: (docId: string) =>
    request<Comment[]>(`/api/documents/${docId}/comments`),
  addComment: (docId: string, body: string) =>
    request<{ status: string; id: string }>(`/api/documents/${docId}/comments`, {
      method: 'POST', body: JSON.stringify({ body }),
    }),
  resolveComment: (docId: string, commentId: string) =>
    request<{ status: string }>(`/api/documents/${docId}/comments/${commentId}/resolve`, {
      method: 'PATCH',
    }),
}
```

**验证**：`cd client && npx tsc --noEmit`

---

#### Step 6.3 新建 `client/src/contexts/AuthContext.tsx`

```typescript
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../services/api'
import type { User } from '../types'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (u: string, p: string) => Promise<void>
  register: (u: string, p: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null as any)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    api.me()
      .then(r => setUser(r.user))
      .catch(() => { localStorage.removeItem('token') })
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    const r = await api.login(username, password)
    localStorage.setItem('token', r.token)
    setUser(r.user)
  }

  const register = async (username: string, password: string) => {
    const r = await api.register(username, password)
    localStorage.setItem('token', r.token)
    setUser(r.user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>
}
```

**验证**：`cd client && npx tsc --noEmit`

---

#### Step 6.4 新建 `client/src/components/LoginPage.tsx`

```typescript
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          {/* 同 DocsPage 的 brand icon */}
          <h1>NexaDoc</h1>
        </div>
        <form onSubmit={submit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-label="Username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password"
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={!username || !password}>Log in</button>
        </form>
        <p className="auth-switch">
          No account? <a href="/register">Register</a>
        </p>
      </div>
    </div>
  )
}
```

**验证**：`cd client && npx tsc --noEmit`

---

#### Step 6.5 新建 `client/src/components/RegisterPage.tsx`

```typescript
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await register(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>Create account</h1>
        </div>
        <form onSubmit={submit}>
          <input
            type="text"
            placeholder="Username (min 2 chars)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-label="Username"
          />
          <input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password"
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={username.length < 2 || password.length < 6}>Register</button>
        </form>
        <p className="auth-switch">
          Already have an account? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  )
}
```

**验证**：`cd client && npx tsc --noEmit`

---

### Day 7：修改 App.tsx + Vite 配置 + DocsPage + Editor

#### Step 7.1 修改 `client/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/yjs': { target: 'ws://localhost:3001', ws: true, changeOrigin: true },
    },
  },
})
```

**验证**：`cd client && npx tsc --noEmit`

---

#### Step 7.2 修改 `client/src/App.tsx`

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import DocsPage from './components/DocsPage'
import Editor from './components/Editor'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><DocsPage /></ProtectedRoute>} />
          <Route path="/:id" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

**验证**：`cd client && npx tsc --noEmit`

---

#### Step 7.3 修改 `client/src/components/DocsPage.tsx`

**关键改动点**：
1. 删除 `import { getDocs, saveDocs } from '../services/storage'`
2. 新增 `import { api } from '../services/api'`
3. `useEffect` 中 `getDocs()` → `api.listDocuments()`
4. `createDoc` 中 `saveDocs()` → `api.createDocument()`
5. `deleteDoc` 中 `saveDocs()` → `api.deleteDocument()`
6. `DocumentMeta` 类型需要包含 `abilities` 可选字段（已在 Step 6.1 中不包含，但 server 返回时会带 `abilities`，需要加 `abilities?: any` 或在 `DocumentMeta` 中添加）

```typescript
// 在 types/index.ts 的 DocumentMeta 中添加：
export interface DocumentMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  parentId?: string | null
  deletedAt?: number | null
  abilities?: DocumentAbilities  // 从 API 返回
}
```

```typescript
// DocsPage.tsx 关键改动：
useEffect(() => {
  api.listDocuments()
    .then(setDocs)
    .catch(() => {
      // 离线 fallback
      const cached = JSON.parse(localStorage.getItem('docs') || '[]')
      setDocs(cached)
    })
}, [])

const createDoc = async () => {
  const name = newName.trim()
  if (!name) return
  try {
    const doc = await api.createDocument(name)
    setDocs(prev => [doc, ...prev])
    closeModal()
    navigate('/' + doc.id)
  } catch (e: any) {
      setError(e.message)
  }
}

const deleteDoc = async (id: string) => {
  try {
    await api.deleteDocument(id)
    setDocs(prev => prev.filter(d => d.id !== id))
  } catch (e: any) {
      // ignore
  }
  setDeleteTarget(null)
}
```

**验证**：
```bash
# 前端 dev 服务器启动
cd client && npm run dev
# 浏览器打开 http://localhost:5173 → 跳转到 /login
# 登录后 → 看到文档列表（从 API 加载）
# 创建文档 → 跳转到编辑器
# 回到首页 → 新文档出现在列表中
```

---

#### Step 7.4 修改 `client/src/components/Editor.tsx`

**关键改动点**：
1. 新增 `import { useAuth } from '../contexts/AuthContext'`
2. 新增 `import { api } from '../services/api'`
3. 新增 `import * as Y from 'yjs'`（用于快照恢复）
4. `session` 创建改为从 `useAuth()` 获取用户信息
5. `handleTitleChange` 中 `saveDocName` → `api.updateDocumentTitle`
6. 新增版本历史按钮和模态框

```typescript
// 在组件顶部：
const { user } = useAuth()

const [session, setSession] = useState<CollabSession | null>(() => {
  if (!id || !user) return null
  return createYjs(id, { id: user.id, name: user.displayName, color: user.avatarColor })
})

// 标题保存改为 API
const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const newTitle = e.target.value
  setTitle(newTitle)
  api.updateDocumentTitle(id || '', newTitle).catch(() => {})
}, [id])

// 版本历史
const [historyOpen, setHistoryOpen] = useState(false)

// 在 topbar-right 的 export-group 前面加一个 History 按钮:
<button className="export-btn" onClick={() => setHistoryOpen(true)} title="Version history">
  History
</button>

// 在 JSX 末尾加:
{historyOpen && (
  <VersionHistoryModal
    docId={id || ''}
    session={session!}
    onClose={() => setHistoryOpen(false)}
  />
)}
```

**验证**：
```bash
cd client && npx tsc --noEmit
# 浏览器：编辑器顶部出现 History 按钮
# 编辑器中 awareness 用户名显示为真实用户名（而非 User-XXXX）
# 修改标题 → 刷新页面 → 标题保留（从 MongoDB 读取）
```

---

### Day 8：版本历史 + 分享 + 评论 UI

#### Step 8.1 新建 `client/src/components/VersionHistoryModal.tsx`

```typescript
import { useState, useEffect } from 'react'
import { api } from '../services/api'
import * as Y from 'yjs'
import type { SnapshotMeta, CollabSession } from '../types'

interface Props {
  docId: string
  session: CollabSession
  onClose: () => void
}

function timeAgo(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function VersionHistoryModal({ docId, session, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    setLoading(true)
    api.listSnapshots(docId).then(s => { setSnapshots(s); setLoading(false) })
  }

  useEffect(refresh, [docId])

  const createSnapshot = async () => {
    const text = session.doc.getText ? (session.doc.getText() as any).toString() : ''
    await api.createSnapshot(docId, `Manual ${new Date().toLocaleString()}`, text.slice(0, 120))
    refresh()
  }

  const restore = async (snap: SnapshotMeta) => {
    const { crdtState } = await api.restoreSnapshot(docId, snap._id)
    Y.applyUpdate(session.doc, new Uint8Array(crdtState))
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Version history</h2>

        <button className="new-doc-btn" onClick={createSnapshot} style={{ marginBottom: 16 }}>
          Save current version
        </button>

        {loading ? (
          <p>Loading…</p>
        ) : snapshots.length === 0 ? (
          <p className="modal-subtitle">No saved versions yet.</p>
        ) : (
          <div className="docs-list">
            {snapshots.map(s => (
              <div key={s._id} className="doc-card" onClick={() => restore(s)}>
                <div className="doc-card-body">
                  <div className="doc-card-name">{s.name}</div>
                  <div className="doc-card-meta">
                    <span>{s.authorName}</span>
                    <span>{timeAgo(s.createdAt)}</span>
                  </div>
                  <div className="doc-card-preview">{s.preview}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
```

**验证**：编辑器中点 History → 创建快照 → 列表显示 → 点恢复 → 编辑器内容回滚 → 协作者也同步。

---

#### Step 8.2 新建 `client/src/components/ShareModal.tsx`

```typescript
import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { DocumentAccess } from '../types'

interface Props {
  docId: string
  onClose: () => void
}

const ROLE_LABELS: Record<string, string> = {
  reader: 'Reader',
  commenter: 'Commenter',
  editor: 'Editor',
  administrator: 'Admin',
  owner: 'Owner',
}

export function ShareModal({ docId, onClose }: Props) {
  const [access, setAccess] = useState<DocumentAccess[]>([])
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('reader')
  const [error, setError] = useState('')

  const refresh = () => {
    api.listAccess(docId).then(setAccess).catch(() => {})
  }

  useEffect(refresh, [docId])

  const share = async () => {
    setError('')
    try {
      await api.shareDocument(docId, username, role)
      setUsername('')
      refresh()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Share document</h2>

        <div className="share-form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-label="Username"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="reader">Reader</option>
            <option value="commenter">Commenter</option>
            <option value="editor">Editor</option>
            <option value="administrator">Admin</option>
          </select>
          <button className="modal-create" onClick={share} disabled={!username.trim()}>
            Invite
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <p className="section-label">People with access</p>
        {access.map(a => (
          <div key={a._id} className="access-row">
            <div className="avatar" style={{ background: '#1a73e8' }}>
              {a.username[0]?.toUpperCase()}
            </div>
            <div className="access-info">
              <div>{a.username}</div>
              <div className="access-role">{ROLE_LABELS[a.role] || a.role}</div>
            </div>
            {a.role !== 'owner' && (
              <button
                className="modal-cancel"
                onClick={() => api.removeAccess(docId, a.userId).then(refresh)}
              >
                Remove
              </button>
            )}
          </div>
        ))}

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
```

**验证**：编辑器中打开 Share → 输入 bob → 选 Editor → Invite → 列表显示 bob。

---

#### Step 8.3 新建 `client/src/components/CommentPanel.tsx`

```typescript
import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { Comment } from '../types'

interface Props {
  docId: string
  onClose: () => void
}

function timeAgo(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

export function CommentPanel({ docId, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')

  const refresh = () => api.listComments(docId).then(setComments)
  useEffect(refresh, [docId])

  const add = async () => {
    if (!body.trim()) return
    await api.addComment(docId, body)
    setBody('')
    refresh()
  }

  const resolve = async (id: string) => {
    await api.resolveComment(docId, id)
    refresh()
  }

  return (
    <div className="comment-panel">
      <div className="comment-panel-header">
        <h2>Comments</h2>
        <button onClick={onClose}>×</button>
      </div>

      <div className="comment-input-row">
        <input
          type="text"
          placeholder="Add a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        />
        <button onClick={add}>Add</button>
      </div>

      <div className="comment-list">
        {comments.map(c => (
          <div key={c._id} className={`comment-item ${c.resolved ? 'resolved' : ''}`}>
            <div className="comment-author">
              <div className="avatar" style={{ background: '#1a73e8' }}>
                {c.authorName[0]?.toUpperCase()}
              </div>
              <span>{c.authorName}</span>
              <span className="comment-time">{timeAgo(c.createdAt)}</span>
            </div>
            <div className="comment-body">{c.body}</div>
            {!c.resolved && (
              <button className="comment-resolve" onClick={() => resolve(c._id)}>
                Resolve
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**验证**：编辑器侧边栏添加评论 → 列表显示 → Resolve → 评论标记为已解决。

---

### Day 9：Feature-based 目录重构

#### Step 9.1 创建 feature-based 目录结构

```
client/src/
  features/
    auth/
      AuthContext.tsx       (从 client/src/contexts/AuthContext.tsx 移入)
      LoginPage.tsx       (从 client/src/components/LoginPage.tsx 移入)
      RegisterPage.tsx    (从 client/src/components/RegisterPage.tsx 移入)
    docs/
      DocsPage.tsx        (从 client/src/components/DocsPage.tsx 移入)
      VersionHistoryModal.tsx
      ShareModal.tsx
      CommentPanel.tsx
    editor/
      Editor.tsx         (从 client/src/components/Editor.tsx 移入)
      EditorToolbar.tsx  (从 client/src/components/EditorToolbar.tsx 移入)
    shared/
      api.ts             (从 client/src/services/api.ts 移入)
      types.ts          (从 client/src/types/index.ts 移入)
      generateId.ts     (从 client/src/utils/generateId.ts 移入)
  extensions/
    FontSize.ts
  App.tsx
  main.tsx
  index.css
```

#### Step 9.2 更新所有 import 路径

| 旧路径 | 新路径 |
|---|---|
| `import { api } from '../services/api'` | `import { api } from '../features/shared/api'` |
| `import type { ... } from '../types'` | `import type { ... } from '../features/shared/types'` |
| `import { useAuth } from '../contexts/AuthContext'` | `import { useAuth } from '../features/auth/AuthContext'` |
| `import { EditorToolbar } from './EditorToolbar'` | 不变（同目录） |
| `import DocsPage from './components/DocsPage'` | `import DocsPage from './features/docs/DocsPage'` |
| `import Editor from './components/Editor'` | `import Editor from './features/editor/Editor'` |

**验证**：
```bash
cd client && npx tsc --noEmit && echo "✓ 所有 import 路径正确"
npm run dev  # 浏览器全流程验证
```

---

### Day 10：CSS 样式 + README + 最终验收

#### Step 10.1 在 `client/src/index.css` 中追加新组件样式

需要新增的 CSS 类：
- `.auth-page`, `.auth-card`, `.auth-brand`, `.auth-error`, `.auth-switch`
- `.share-form`, `.access-row`, `.access-info`, `.access-role`
- `.comment-panel`, `.comment-panel-header`, `.comment-input-row`, `.comment-list`, `.comment-item`, `.comment-author`, `.comment-body`, `.comment-resolve`
- `.loading`

```css
/* ── Auth pages ── */
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f8f9fa;
}
.auth-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 400px;
}
.auth-card h1 { margin: 0 0 24px; font-size: 24px; }
.auth-card input {
  width: 100%; padding: 10px 12px; margin-bottom: 12px;
  border: 1px solid #dadce0; border-radius: 8px; font-size: 14px;
}
.auth-card button[type="submit"] {
  width: 100%; padding: 10px; background: #1a73e8; color: white;
  border: none; border-radius: 8px; font-size: 14px; cursor: pointer;
}
.auth-error { color: #d93025; font-size: 13px; margin-bottom: 12px; }
.auth-switch { text-align: center; margin-top: 16px; font-size: 14px; color: #5f6368; }
.auth-switch a { color: #1a73e8; text-decoration: none; }

/* ── Share modal ── */
.share-form { display: flex; gap: 8px; margin-bottom: 16px; }
.share-form input { flex: 1; padding: 8px; border: 1px solid #dadce0; border-radius: 8px; }
.share-form select { padding: 8px; border: 1px solid #dadce0; border-radius: 8px; }
.access-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.access-info { flex: 1; }
.access-info > div:first-child { font-size: 14px; }
.access-role { font-size: 12px; color: #5f6368; }

/* ── Comment panel ── */
.comment-panel {
  position: fixed; right: 0; top: 0; bottom: 0; width: 320px;
  background: white; box-shadow: -2px 0 8px rgba(0,0,0,0.1);
  display: flex; flex-direction: column; z-index: 100;
}
.comment-panel-header { display: flex; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e0e0e0; }
.comment-input-row { display: flex; gap: 8px; padding: 12px 16px; }
.comment-input-row input { flex: 1; padding: 8px; border: 1px solid #dadce0; border-radius: 8px; }
.comment-list { flex: 1; overflow-y: auto; padding: 0 16px; }
.comment-item { padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.comment-item.resolved { opacity: 0.5; }
.comment-author { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.comment-time { font-size: 11px; color: #5f6368; }
.comment-body { font-size: 14px; margin-bottom: 4px; }
.comment-resolve { font-size: 12px; color: #1a73e8; background: none; border: none; cursor: pointer; }
```

**验证**：`npm run dev` → 页面样式正常。

---

#### Step 10.2 最终验收清单

```bash
# ── 服务端 ──
# 1. MongoDB 连接
docker exec -it mongo-docs mongosh nexadoc --eval "db.documents.countDocuments()"
# 2. 所有 API 端点 curl 测试（见 Day 2-4 验证命令）
# 3. TypeScript 编译
cd server && npx tsc --noEmit && echo "✓"

# ── 客户端 ──
# 4. TypeScript 编译
cd client && npx tsc --noEmit && echo "✓"
# 5. 构建
npm run build && echo "✓"

# ── 浏览器端到端 ──
# 6. http://localhost:5173 → 跳转 /login
# 7. 注册 alice → 跳转 /
# 8. 创建文档 → 跳转编辑器 → 编辑器显示真实用户名
# 9. 编辑内容 → 1 秒后重启 server → 内容保留
# 10. 开第二个标签（注册 bob）→ alice 分享给 bob → bob 能看到文档
# 11. bob 编辑器中实时同步、远程光标
# 12. 版本历史：创建快照 → 恢复
# 13. 评论：添加 → 解决
# 14. PDF / DOCX 导出
# 15. 字数统计
# 16. 权限：bob (reader) 尝试编辑 → 被拒绝或 UI 隐藏编辑按钮
```

---

## 五、风险与注意事项

### 风险 1: y-websocket v2 persistence API
`setupWSConnection` 第三参数的 `persistence` 接口需在 Day 0 验证。如果 v2 不支持，回退方案是**不使用 `setupWSConnection` 的 persistence 参数**，改为在 `wss.on('connection')` 中手动调用 `mongoPersistence.bindState()` / `writeState()`：

```typescript
wss.on('connection', async (ws, req) => {
  const docName = new URL(req.url, 'http://x').pathname.replace('/yjs/', '')
  const ydoc = new Y.Doc()
  await mongoPersistence.bindState(docName, ydoc)
  // 手动处理 sync protocol...
  // 这需要复制 setupWSConnection 的逻辑
})
```

> **建议**：Day 0 先写一个 5 行的最小测试确认 API，再决定实现方式。

### 风险 2: MongoDB 环境
用户本地需安装 MongoDB。提供 Docker 一键启动作为备选（Day 0.1）。

### 风险 3: StrictMode 双重初始化
`main.tsx` 保持**不使用** StrictMode，避免 Yjs provider 双重创建。

### 风险 4: WebSocket 连接层的权限检查
REST API 有 `requireAuth` 中间件保护，但 Yjs WebSocket 连接默认无认证。Day 5 在 `wss.on('connection')` 中从 URL query 提取 token 验证权限。客户端 `yjsProvider.ts` 需要在 WS_URL 上附加 `?token=xxx`。

### 风险 5: 路由前缀冲突
`sharing.ts`、`comments.ts`、`snapshots.ts` 都有 `/:docId/...` 和 `/:id/...` 两种路径。统一所有子路由挂载在 `/api/documents` 下，避免 Express 路由匹配歧义（Day 4 末尾整理）。

### 风险 6: 评论的 documentId 类型
MongoDB 的 `_id` 是 `ObjectId`，但 `comment.ts` 中 `documentId: new ObjectId(req.params.docId)` 需要确认 `req.params.docId` 是 `docId` 字符串还是 `ObjectId`。当前设计：`documents` 集合中 `docId` 是字符串、`_id` 是 ObjectId。`comments.documentId` 应存储 `documents._id`（ObjectId），查询时需要 `new ObjectId(req.params.docId)` → 但 `req.params.docId` 是字符串 docId，应先 `findOne({ docId: req.params.docId})` 拿到 `_id`，再用 `_id` 关联。**修正**：在路由中先查 doc 的 `_id`，再用 `doc._id` 查询 comments。

---

## 六、与 UPGRADE_PLAN.md 的差异

原 `UPGRADE_PLAN.md` 的三阶段计划已部分完成。本计划做了以下调整：

1. **Phase 2 范围扩大**：原计划 Phase 2 仅含 MongoDB + 版本历史 + 用户 schema 预留；本计划将 JWT 认证、RBAC 权限、分享/评论也纳入，因为权限系统是本阶段的核心。
2. **Phase 1 代码修改清单**：明确列出 9 个需修改文件 + 18 个新建文件，每个都有具体代码和验证命令。
3. **feature-based 前端**：新增 Day 9 的目录重构步骤。
4. **RBAC 完整实现**：新增 `server/src/rbac.ts`，完整实现角色权限模型与能力契约。
5. **WebSocket 层认证**：新增 Day 5 的 WS token 验证 + 权限检查。
