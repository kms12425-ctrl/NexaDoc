# NexaDoc 升级计划

## 项目目标

将多人协作编辑器升级为生产级协作文档编辑器，引入 TypeScript、TipTap、MongoDB 持久化与版本历史。

## 当前项目状态

- **前端**: React 19 + Vite 6 + Quill + Socket.IO + Yjs，纯 JavaScript
- **后端**: Express 5 + Socket.IO + Yjs WebSocket（单进程端口 3001）
- **持久化**: 内存（重启丢失）+ 客户端 IndexedDB
- **已验证**: 多人在线编辑正常工作，PDF/DOCX 导出、文档管理页、大文档分块传输均可用

## 升级方向

| 维度 | 当前 | 目标 |
|---|---|---|
| 语言 | JavaScript | TypeScript（strict 模式） |
| 编辑器内核 | Quill + y-quill | TipTap (ProseMirror) + @tiptap/extension-collaboration |
| 实时通道 | Socket.IO + Yjs WebSocket 双通道 | 纯 Yjs WebSocket（单通道，更简洁） |
| 持久化 | 内存 | MongoDB（文档 CRDT + 元数据 + 用户 + 协作权限） |
| 版本历史 | 无 | Yjs snapshot 快照 + 恢复（存储在 MongoDB） |
| 用户系统 | 无（随机用户名） | 预留 users + collaborations schema（阶段二），后续实现注册登录 |
| React | 19 | 18（TipTap 生态兼容性更好） |

## 保留的现有功能

- PDF 导出（html2pdf.js）
- DOCX 导出（file-saver）
- 文档管理页（DocsPage：列表/搜索/创建/删除）
- 大文档分块传输（需适配新架构）

## 本次升级范围外

- Chaos 测试面板（后续阶段再考虑）
- 分屏双端测试
- 活动流
- 光标碰撞检测

## 升级原则

1. **每阶段结束后项目必须可运行**——不破坏已有功能
2. **先架构后功能**——先把地基换好，再添砖加瓦
3. **保持简洁**——只做必要的改造，不过度设计

---

## 阶段一：核心架构升级（JS→TS + Quill→TipTap + Socket.IO→纯Yjs WS）

### 1.1 客户端基础设施迁移

#### 1.1.1 初始化 TypeScript + React 18 + TipTap 依赖

**文件**: `client/package.json`

- 降级 React 18→19 为 18.3（TipTap 2.11 生态兼容性最佳）
- 新增 TypeScript 工具链: `typescript`, `@types/react`, `@types/react-dom`, `@types/node`
- 移除 Quill 相关: `quill`, `quill-cursors`, `y-quill`
- 新增 TipTap 相关: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-highlight`, `@tiptap/extension-placeholder`
- 移除 Socket.IO: `socket.io-client`
- 保留: `yjs`, `y-websocket`, `y-indexeddb`, `lucide-react`, `docx`, `file-saver`, `html2pdf.js`
- Vite 构建脚本改为 `tsc && vite build`

#### 1.1.2 TypeScript 配置

**新建文件**: `client/tsconfig.json`, `client/tsconfig.node.json`

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

#### 1.1.3 Vite 配置更新

**文件**: `client/vite.config.js` → `client/vite.config.ts`

- 添加 Vite WebSocket 代理（/yjs 路径代理到后端 3001）
- 移除 Socket.IO 代理（不再需要）

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/yjs': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
```

### 1.2 客户端源码迁移

#### 1.2.1 类型定义

**新建文件**: `client/src/types/index.ts`

```typescript
// 用户 awareness 状态
export interface UserAwareness {
  id: string
  name: string
  color: string
}

// 协作会话
export interface CollabSession {
  doc: Y.Doc
  provider: WebsocketProvider
  persistence: IndexeddbPersistence
  user: UserAwareness
  roomName: string
  destroy: () => void
}

// 文档元数据
export interface DocumentMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

// 连接状态
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
```

#### 1.2.2 Yjs Provider 服务

**文件**: `client/src/services/yjsProvider.js` → `client/src/services/yjsProvider.ts`

- 移除 Socket.IO 依赖，只保留 Yjs WebSocket Provider
- 添加 TypeScript 类型
- WS_URL 从环境变量读取，dev 模式通过 Vite 代理连接后端 3001

```typescript
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CollabSession, UserAwareness } from '../types'

const WS_URL = import.meta.env.VITE_YJS_URL || 'ws://localhost:3001/yjs'

export function createYjs(
  docId: string,
  customUser?: Partial<UserAwareness>
): CollabSession {
  const ydoc = new Y.Doc()
  const persistence = new IndexeddbPersistence(docId, ydoc)
  const provider = new WebsocketProvider(WS_URL, docId, ydoc)

  const user: UserAwareness = customUser
    ? { id: customUser.id || ..., name: customUser.name || ..., color: customUser.color || ... }
    : { /* 随机生成 */ }

  provider.awareness.setLocalStateField('user', user)

  const destroy = () => {
    provider.destroy()
    persistence.destroy()
    ydoc.destroy()
  }

  return { doc: ydoc, provider, persistence, user, roomName: docId, destroy }
}
```

#### 1.2.3 Storage 服务

**文件**: `client/src/services/storage.js` → `client/src/services/storage.ts`

- 添加 TypeScript 类型（DocumentMeta 接口）
- 逻辑不变

#### 1.2.4 Editor 组件重写

**文件**: `client/src/components/Editor.jsx` → `client/src/components/Editor.tsx`

这是最大的改动。核心替换：

| 旧（Quill） | 新（TipTap） |
|---|---|
| `new Quill(container, {...})` | `useEditor({ extensions: [...] })` |
| `QuillBinding(ytext, quill, awareness)` | `Collaboration.configure({ document: session.doc })` + `CollaborationCursor.configure({ provider, user })` |
| `quill.on('text-change', ...)` | `editor.on('update', ...)` 或 `onUpdate` 回调 |
| `quill.getModule('cursors')` | `CollaborationCursor` 扩展自动处理 |
| 手动 toolbar container | `<GoogleDocsToolbar editor={editor} />` 组件 |
| `quill.getText()` | `editor.getText()` |

**需要新建的子组件**:

- `client/src/components/EditorToolbar.tsx`——从 Editor.jsx 中拆出工具栏
  - 字体选择（13 种 Google Fonts）
  - 字号选择（8pt-72pt，15 档）
  - 粗体/斜体/下划线/删除线
  - 文字颜色/背景色
  - 对齐方式
  - 有序/无序列表
  - 缩进
  - 链接
  - 清除格式

  注意：TipTap 的字体/字号需要自定义扩展（TipTap 没有内置 font-family/font-size 扩展），可以：
  - 方案 A: 使用 `@tiptap/extension-font-family`（社区扩展）+ 自定义 FontSize 扩展
  - 方案 B: 用 TextStyle + 自定义属性
  - 建议方案 A，更标准化

**Editor.tsx 保留的功能**:
- 文档标题编辑 + awareness 同步
- 协作者头像列表
- 连接状态指示器
- 编辑/查看模式切换
- PDF / DOCX 导出（适配 TipTap 的 DOM 结构）
- 字数统计

**Editor.tsx 移除的功能**:
- Socket.IO 连接（`io(API_URL)`, `join-document`, `load-document-chunk` 等）
- Quill 相关的所有代码
- 手动 cursor 管理（由 CollaborationCursor 扩展接管）

#### 1.2.5 DocsPage 组件迁移

**文件**: `client/src/components/DocsPage.jsx` → `client/src/components/DocsPage.tsx`

- 添加 TypeScript 类型
- 逻辑基本不变（localStorage 文档管理）
- 移除对 Socket.IO 的任何引用（如果有）

#### 1.2.6 App 和 main 迁移

**文件**: `client/src/App.jsx` → `client/src/App.tsx`, `client/src/main.jsx` → `client/src/main.tsx`

- 添加 TypeScript 类型
- 路由结构不变

#### 1.2.7 generateId 工具迁移

**文件**: `client/src/utils/generateId.js` → `client/src/utils/generateId.ts`

- 添加 TypeScript 类型

#### 1.2.8 CSS 适配

**文件**: `client/src/index.css`

- 移除 Quill 专属样式（`.ql-editor`, `.ql-toolbar`, `.ql-snow` 等）
- 添加 TipTap / ProseMirror 样式（`.ProseMirror`, `.tiptap` 等）
- 保留设计系统的 CSS 变量和通用样式
- 保留 Google Fonts 导入（TipTap 编辑器也需要这些字体）

### 1.3 服务端迁移

#### 1.3.1 TypeScript 化

**新建文件**: `server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

#### 1.3.2 server/index.js → server/src/server.ts

**文件**: `server/index.js` → `server/src/server.ts`

核心改动：
- **移除 Socket.IO**——不再需要 `socket.io` 和 `socket.io-client`
  - `join-document`, `send-changes`, `save-document`, `load-document-chunk` 事件全部移除
  - 文档同步完全由 Yjs WebSocket 的 `setupWSConnection` 处理
- **移除内存文档存储**——`documents` 对象和 `documentOrder` 数组删除
  - 持久化由阶段二的 DiskPersistence 接管
  - 阶段一暂时只用 Yjs WebSocket 的内存同步（无持久化，重启丢失——与原行为一致）
- **保留** Express + health 端点
- **保留** Yjs WebSocket 服务（`/yjs` 路径）
- **保留** CORS 配置
- **保留** 优雅关闭

```typescript
import express from 'express'
import http from 'http'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'

const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true })

wss.on('connection', setupWSConnection)

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://x').pathname
  if (pathname === '/yjs') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }
})

server.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
})
```

#### 1.3.3 server/package.json 更新

- 移除 `socket.io`
- 添加 TypeScript 工具链: `typescript`, `@types/node`, `@types/express`, `@types/cors`, `@types/ws`, `ts-node`
- 修改 scripts: `dev: ts-node src/server.ts`, `build: tsc`, `start: node dist/server.js`

### 1.4 阶段一验收标准

- [ ] `npm run build` 在 client 和 server 都成功（TypeScript 编译无错误）
- [ ] `npm run dev` 启动后端（3001）和前端（5173）
- [ ] 浏览器打开 http://localhost:5173，文档列表页正常显示
- [ ] 创建文档、删除文档、搜索文档正常工作
- [ ] 进入编辑器，TipTap 工具栏完整显示（字体/字号/粗斜体/颜色/对齐/列表等）
- [ ] 富文本编辑正常（所有格式按钮可用）
- [ ] 开两个浏览器标签打开同一文档，实时同步正常
- [ ] 远程光标显示正常（颜色 + 用户名）
- [ ] 协作者头像列表正常显示
- [ ] 连接状态指示器正常（Connected/Offline）
- [ ] PDF 导出正常
- [ ] DOCX 导出正常
- [ ] 字数统计正常
- [ ] 文档标题编辑 + 同步正常
- [ ] 编辑/查看模式切换正常
- [ ] IndexedDB 离线缓存正常（刷新页面内容不丢失）

---

## 阶段二：MongoDB 持久化 + 版本历史 + 用户 schema 预留

### 2.0 MongoDB 数据库设计

#### 2.0.1 环境准备

- 本地 MongoDB（`mongodb://localhost:27017`）
- 数据库名：`nexadoc`
- 服务端新增依赖：`mongodb`（官方 Node.js 驱动）

#### 2.0.2 Collection 设计

**`users`（用户——阶段二仅预留 schema，不实现注册登录）**

```typescript
interface UserDoc {
  _id: ObjectId
  username: string           // 唯一用户名
  email: string              // 邮箱（唯一，预留）
  passwordHash: string       // 密码哈希（预留，阶段二不填充）
  displayName: string        // 显示名称
  avatarColor: string        // 头像颜色
  createdAt: Date
  updatedAt: Date
}
// 索引: { username: 1 } unique, { email: 1 } unique sparse
```

**`documents`（文档——核心集合）**

```typescript
interface DocumentDoc {
  _id: ObjectId
  docId: string              // Yjs room name（唯一，用作 WebSocket 路由）
  title: string              // 文档标题
  ownerUserId: ObjectId | null  // 所有者（阶段二为 null，后续认证实现后填充）
  crdtState: Buffer          // Y.encodeStateAsUpdate(doc) 的二进制数据
  crdtStateSize: number      // crdtState.length（便于查询统计）
  updateCount: number        // 更新次数（每次保存递增）
  createdAt: Date
  updatedAt: Date
}
// 索引: { docId: 1 } unique, { ownerUserId: 1 }, { updatedAt: -1 }
```

**`collaborations`（协作者权限——阶段二仅预留 schema）**

```typescript
interface CollaborationDoc {
  _id: ObjectId
  documentId: ObjectId       // 关联 documents._id
  userId: ObjectId           // 协作者用户 ID
  role: 'owner' | 'editor' | 'viewer'  // 权限角色
  invitedAt: Date
  acceptedAt: Date | null
}
// 索引: { documentId: 1, userId: 1 } unique
```

**`snapshots`（版本历史快照）**

```typescript
interface SnapshotDoc {
  _id: ObjectId
  documentId: ObjectId       // 关联 documents._id
  name: string               // 快照名称（用户命名）
  crdtState: Buffer          // Y.encodeStateAsUpdate(doc) 的完整 CRDT 状态
  crdtStateSize: number
  authorUserId: ObjectId | null  // 创建者（阶段二为 null）
  authorName: string         // 创建者显示名（冗余，阶段二从 awareness 获取）
  preview: string            // 文本预览（前 120 字符）
  createdAt: Date
}
// 索引: { documentId: 1, createdAt: -1 }
```

#### 2.0.3 为什么用 MongoDB 而非磁盘文件

| 对比 | 磁盘文件 | MongoDB |
|---|---|---|
| 查询能力 | 只能遍历目录 | 支持索引、条件查询、分页 |
| 并发安全 | 无文件锁，需自己处理 | 数据库级并发控制 |
| 扩展性 | 单机 | 可副本集、分片 |
| 用户系统 | 无法关联 | 天然支持关联查询 |
| 版本历史 | 需额外管理文件 | 一个 collection 搞定 |
| 后续认证 | 需另建数据库 | 同库即可 |

### 2.1 MongoDB 持久化层

#### 2.1.1 数据库连接

**新建文件**: `server/src/db.ts`

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

  // 创建索引（幂等操作）
  await dbInstance.collection('users').createIndex({ username: 1 }, { unique: true })
  await dbInstance.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true })
  await dbInstance.collection('documents').createIndex({ docId: 1 }, { unique: true })
  await dbInstance.collection('documents').createIndex({ updatedAt: -1 })
  await dbInstance.collection('collaborations').createIndex(
    { documentId: 1, userId: 1 }, { unique: true }
  )
  await dbInstance.collection('snapshots').createIndex({ documentId: 1, createdAt: -1 })

  console.log(`[db] Connected to MongoDB: ${DB_NAME}`)
  return dbInstance
}

export function getDB(): Db {
  if (!dbInstance) throw new Error('Database not connected. Call connectDB() first.')
  return dbInstance
}
```

#### 2.1.2 文档持久化服务

**新建文件**: `server/src/persistence.ts`

```typescript
import * as Y from 'yjs'
import { getDB } from './db'
import type { DocumentDoc, SnapshotDoc } from './types'

const DEBOUNCE_MS = 1000
const writeDebounceTimers = new Map<string, NodeJS.Timeout>()

// y-websocket 持久化接口
export const mongoPersistence = {
  // 文档首次加载时调用——从 MongoDB 读取 CRDT 状态
  bindState: async (docName: string, ydoc: Y.Doc): Promise<void> => {
    const db = getDB()
    const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: docName })

    if (doc && doc.crdtState) {
      Y.applyUpdate(ydoc, new Uint8Array(doc.crdtState.buffer))
    } else {
      // 新文档——创建记录
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

    // 监听更新，debounce 写入 MongoDB
    ydoc.on('update', (update: Uint8Array) => {
      scheduleSave(docName, ydoc)
    })
  },

  // 文档所有连接断开时调用——立即写入
  writeState: async (docName: string, ydoc: Y.Doc): Promise<void> => {
    const timer = writeDebounceTimers.get(docName)
    if (timer) {
      clearTimeout(timer)
      writeDebounceTimers.delete(docName)
    }
    await saveImmediate(docName, ydoc)
  },
}

async function scheduleSave(docName: string, ydoc: Y.Doc): Promise<void> {
  const existing = writeDebounceTimers.get(docName)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    saveImmediate(docName, ydoc)
    writeDebounceTimers.delete(docName)
  }, DEBOUNCE_MS)

  writeDebounceTimers.set(docName, timer)
}

async function saveImmediate(docName: string, ydoc: Y.Doc): Promise<void> {
  const db = getDB()
  const stateUpdate = Y.encodeStateAsUpdate(ydoc)
  const stateBuffer = Buffer.from(stateUpdate)

  await db.collection<DocumentDoc>('documents').updateOne(
    { docId: docName },
    {
      $set: {
        crdtState: stateBuffer,
        crdtStateSize: stateBuffer.length,
        updatedAt: new Date(),
      },
      $inc: { updateCount: 1 },
      $setOnInsert: {
        title: docName,
        ownerUserId: null,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  )
}
```

#### 2.1.3 REST API 端点

**文件**: `server/src/server.ts`（在阶段一基础上扩展）

```typescript
// 列出所有文档
app.get('/api/documents', async (_req, res) => {
  const db = getDB()
  const docs = await db.collection('documents')
    .find({}, { projection: { crdtState: 0 } })  // 不返回大二进制
    .sort({ updatedAt: -1 })
    .toArray()
  res.json(docs)
})

// 获取文档元数据
app.get('/api/documents/:docId/metadata', async (req, res) => {
  const db = getDB()
  const doc = await db.collection('documents').findOne(
    { docId: req.params.docId },
    { projection: { crdtState: 0 } }
  )
  res.json(doc || { error: 'Not found' })
})

// 更新文档标题
app.patch('/api/documents/:docId/metadata', async (req, res) => {
  const db = getDB()
  await db.collection('documents').updateOne(
    { docId: req.params.docId },
    { $set: { title: req.body.title, updatedAt: new Date() } }
  )
  res.json({ status: 'ok' })
})

// 删除文档
app.delete('/api/documents/:docId', async (req, res) => {
  const db = getDB()
  await db.collection('documents').deleteOne({ docId: req.params.docId })
  await db.collection('snapshots').deleteMany({ documentId: ... })
  res.json({ status: 'ok' })
})

// 版本历史——创建快照
app.post('/api/documents/:docId/snapshots', async (req, res) => {
  const db = getDB()
  const doc = await db.collection('documents').findOne({ docId: req.params.docId })
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  const snapshot = {
    documentId: doc._id,
    name: req.body.name || `Revision ${Date.now()}`,
    crdtState: doc.crdtState,       // 复制当前 CRDT 状态
    crdtStateSize: doc.crdtStateSize,
    authorUserId: null,
    authorName: req.body.author || 'Anonymous',
    preview: req.body.preview || '',
    createdAt: new Date(),
  }
  await db.collection('snapshots').insertOne(snapshot)
  res.json({ status: 'ok', id: snapshot._id })
})

// 版本历史——列出快照
app.get('/api/documents/:docId/snapshots', async (req, res) => {
  const db = getDB()
  const doc = await db.collection('documents').findOne({ docId: req.params.docId })
  if (!doc) return res.json([])

  const snapshots = await db.collection('snapshots')
    .find({ documentId: doc._id }, { projection: { crdtState: 0 } })
    .sort({ createdAt: -1 })
    .toArray()
  res.json(snapshots)
})

// 版本历史——恢复到指定快照
app.post('/api/snapshots/:snapshotId/restore', async (req, res) => {
  const db = getDB()
  const snapshot = await db.collection('snapshots').findOne({ _id: new ObjectId(req.params.snapshotId) })
  if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' })

  // 返回快照的 CRDT 状态，客户端 applyUpdate
  res.json({ crdtState: Array.from(snapshot.crdtState) })
})
```

#### 2.1.4 服务端集成

**文件**: `server/src/server.ts`

- 启动时调用 `connectDB()`
- 将 `mongoPersistence` 传给 y-websocket 的 `setPersistence`
- 添加 `express.json()` 中间件（解析 PATCH/POST body）

#### 2.1.5 客户端适配

**文件**: `client/src/components/DocsPage.tsx`

- 文档列表从 `GET /api/documents` 获取（替代纯 localStorage）
- localStorage 保留作为离线缓存（API 失败时 fallback）
- 文档创建/删除时同步到服务端 API

**文件**: `client/src/services/api.ts`（新建）

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function fetchDocuments(): Promise<DocumentMeta[]>
export async function createDocument(name: string): Promise<DocumentMeta>
export async function deleteDocument(docId: string): Promise<void>
export async function updateDocumentTitle(docId: string, title: string): Promise<void>
export async function createSnapshot(docId: string, name: string, author: string): Promise<void>
export async function listSnapshots(docId: string): Promise<SnapshotMeta[]>
export async function restoreSnapshot(snapshotId: string): Promise<Uint8Array>
```

### 2.2 版本历史

#### 2.2.1 版本历史 UI

**新建文件**: `client/src/components/VersionHistoryModal.tsx`

- 版本历史 UI 设计要点：
  - **存储在 MongoDB 而非 localStorage**——快照跨设备共享
  - **存储完整 CRDT 状态**——可以真正恢复
  - **添加"恢复到此版本"按钮**——调用 restore API，客户端 `Y.applyUpdate`
  - 样式适配现有设计系统

#### 2.2.2 恢复流程

```
用户点击"恢复" → POST /api/snapshots/:id/restore
                     → 服务端返回 crdtState (Uint8Array)
                 → 客户端 Y.applyUpdate(doc, crdtState)
                     → TipTap Collaboration 扩展自动更新编辑器
                     → 变更通过 Yjs WebSocket 同步到其他协作者
```

### 2.3 阶段二验收标准

- [ ] MongoDB 连接成功，4 个 collection 创建且有索引
- [ ] 服务端重启后文档内容不丢失（从 MongoDB 恢复）
- [ ] `GET /api/documents` 返回正确的文档列表
- [ ] 文档标题更新同步到 MongoDB
- [ ] 文档删除时 MongoDB 中的记录和关联快照一并删除
- [ ] 版本历史模态框正常显示
- [ ] 可以创建命名快照（CRDT 状态完整存入 MongoDB）
- [ ] 可以恢复到之前的版本（文档内容实际回滚 + 同步到其他协作者）
- [ ] 快照列表从 MongoDB 获取，跨设备一致
- [ ] users 和 collaborations 集合存在（空集合，为阶段三预留）

---

## 阶段三：用户认证 + 大文档分块 + 收尾优化

### 3.1 用户注册登录（JWT）

#### 3.1.1 服务端认证

**新建文件**: `server/src/auth.ts`

- `POST /api/auth/register`——用户注册（用户名 + 密码，bcrypt 哈希）
- `POST /api/auth/login`——用户登录，返回 JWT token
- `GET /api/auth/me`——获取当前用户（验证 JWT）
- JWT middleware——解析 Authorization header，验证 token，注入 `req.user`
- 依赖新增：`bcryptjs`, `jsonwebtoken`

#### 3.1.2 客户端认证

**新建文件**: `client/src/contexts/AuthContext.tsx`

- 提供 `useAuth()` hook
- 管理 token（localStorage 存储）
- 登录/注册/登出方法
- 自动在 API 请求 header 中附加 JWT

**新建文件**: `client/src/components/LoginPage.tsx`, `client/src/components/RegisterPage.tsx`

- 登录/注册页面
- 路由守卫：未登录跳转登录页

#### 3.1.3 协作权限

- 文档创建时 `ownerUserId` 设为当前用户
- `collaborations` 集合开始写入：owner 自动获得 `owner` 角色
- 编辑器进入时检查用户是否有该文档的访问权限
- 后续：分享文档、邀请协作者、权限管理 UI

### 3.2 大文档分块传输

- 评估 TipTap + Yjs 在大文档场景下的性能
- 如有需要，在 Yjs WebSocket 层实现分块传输（替代原 Socket.IO 方案）

### 3.3 代码质量

- ESLint + Prettier 配置
- 移除所有 `any` 类型
- 添加关键模块的单元测试

### 3.4 文档

- 更新 README.md
- 添加架构图
- 添加开发指南

---

## 技术风险与注意事项

### 风险 1: TipTap 字体/字号扩展

TipTap 没有内置的 font-family 和 font-size 扩展。需要：
- 使用 `@tiptap/extension-font-family`（官方社区扩展）处理字体
- 自定义 FontSize 扩展处理字号（继承 TextStyle，添加 `fontSize` 属性）

如果社区扩展不满足需求，需要自己写 ProseMirror 扩展——这是阶段一最大的技术风险。

### 风险 2: React 18 vs 19 降级

从 React 19 降级到 18 可能导致一些 API 不兼容（如 `useFormStatus`, `use()` 等）。但当前代码用的是基础 hooks（useState, useEffect, useRef, useCallback），降级风险很低。

### 风险 3: y-websocket 版本

当前使用 `y-websocket@^1.5.0`（CommonJS），需统一到 `y-websocket@^2.0.4`。建议用 v2（更新版本，与 TipTap 生态更兼容），但需要验证 `setupWSConnection` API 是否有变化。

### 注意事项: StrictMode

不用 StrictMode（会导致 Yjs provider 双重创建）。升级后继续保持不用 StrictMode，或者用 ref guard 防止双重初始化。

---

## 文件变更清单

### 阶段一变更

| 操作 | 文件路径 |
|---|---|
| 修改 | `client/package.json` |
| 修改 | `client/vite.config.js` → `client/vite.config.ts` |
| 新建 | `client/tsconfig.json` |
| 新建 | `client/tsconfig.node.json` |
| 新建 | `client/src/types/index.ts` |
| 重写 | `client/src/services/yjsProvider.ts` |
| 修改 | `client/src/services/storage.ts` |
| 重写 | `client/src/components/Editor.tsx` |
| 新建 | `client/src/components/EditorToolbar.tsx` |
| 修改 | `client/src/components/DocsPage.tsx` |
| 修改 | `client/src/App.tsx` |
| 修改 | `client/src/main.tsx` |
| 修改 | `client/src/utils/generateId.ts` |
| 修改 | `client/src/index.css` |
| 修改 | `server/package.json` |
| 新建 | `server/tsconfig.json` |
| 重写 | `server/src/server.ts` |
| 删除 | `client/src/components/Editor.jsx` |
| 删除 | `client/src/components/DocsPage.jsx` |
| 删除 | `client/src/App.jsx` |
| 删除 | `client/src/main.jsx` |
| 删除 | `client/src/services/yjsProvider.js` |
| 删除 | `client/src/services/storage.js` |
| 删除 | `client/src/utils/generateId.js` |
| 删除 | `server/index.js` |

### 阶段二新增

| 操作 | 文件路径 |
|---|---|
| 新建 | `server/src/db.ts`（MongoDB 连接 + 索引） |
| 新建 | `server/src/persistence.ts`（MongoDB Yjs 持久化层） |
| 新建 | `server/src/types.ts`（DocumentDoc, SnapshotDoc, UserDoc, CollaborationDoc 接口） |
| 修改 | `server/src/server.ts`（集成 MongoDB 持久化 + REST API） |
| 修改 | `server/package.json`（新增 `mongodb` 依赖） |
| 新建 | `client/src/services/api.ts`（REST API 客户端） |
| 新建 | `client/src/components/VersionHistoryModal.tsx` |
| 修改 | `client/src/components/Editor.tsx`（添加版本历史入口） |
| 修改 | `client/src/components/DocsPage.tsx`（文档列表从 MongoDB 获取） |
| 修改 | `client/src/types/index.ts`（新增 SnapshotMeta 等类型） |

### 阶段三新增

| 操作 | 文件路径 |
|---|---|
| 新建 | `server/src/auth.ts`（JWT 认证中间件 + 注册登录接口） |
| 新建 | `client/src/contexts/AuthContext.tsx` |
| 新建 | `client/src/components/LoginPage.tsx` |
| 新建 | `client/src/components/RegisterPage.tsx` |
| 修改 | `client/src/App.tsx`（添加路由守卫） |
| 修改 | `server/src/server.ts`（认证路由 + 权限检查） |
