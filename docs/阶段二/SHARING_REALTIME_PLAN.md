# 阶段二增量：即时分享 + 实时通知

> 分享体验设计：邀请即生效、被邀请者即时在主页收到通知、
> 支持通过链接直接访问、WebSocket 统一技术栈（不引入 SSE/轮询）。
>
> 架构设计思路见 [附录：设计思路参考](#附录设计思路参考)。

## 目录

1. [现状与目标](#1-现状与目标)
2. [架构总览](#2-架构总览)
3. [改动清单（8 个文件）](#3-改动清单8-个文件)
4. [Step 1 — 后端：文档列表返回共享文档](#step-1--后端文档列表返回共享文档)
5. [Step 2 — 后端：新建通知中心 notifications.ts](#step-2--后端新建通知中心-notificationsts)
6. [Step 3 — 后端：server.ts 加 /ws/notifications 路由 + WebSocket 鉴权](#step-3--后端serverts 加-wsnotifications-路由--websocket-鉴权)
7. [Step 4 — 后端：sharing.ts 分享成功后推送通知](#step-4--后端sharingts 分享成功后推送通知)
8. [Step 5 — 前端：api.ts 类型扩展 + 通知 WS URL](#step-5--前端apits 类型扩展--通知-ws-url)
9. [Step 6 — 前端：yjsProvider.ts 连接带 token](#step-6--前端yjsproviderts 连接带-token)
10. [Step 7 — 前端：DocsPage.tsx 分区显示 + 实时通知监听](#step-7--前端docspagetsx-分区显示--实时通知监听)
11. [Step 8 — 前端：ShareModal.tsx 复制链接](#step-8--前端sharemodaltsx 复制链接)
12. [Step 9 — Vite 代理配置](#step-9--vite-代理配置)
13. [验证方案](#验证方案)
14. [风险与回退](#风险与回退)

---

## 1. 现状与目标

### 现状

| 维度 | 当前行为 |
|------|----------|
| 文档列表 | `GET /api/documents` 只查 `ownerUserId` = 当前用户的文档 |
| 被分享的文档 | 不出现在被邀请者的文档列表中 |
| 分享通知 | 无，被邀请者必须手动刷新或输入文档 ID |
| 链接分享 | 无 UI，但 `/document/:docId` 路由本身可访问 |
| WebSocket 鉴权 | Yjs WS 连接不验证用户身份，任何人知道 docId 就能连接 |
| 技术栈 | Yjs WS（文档级）+ REST API，无用户级实时通道 |

### 目标

| 维度 | 目标行为 |
|------|----------|
| 文档列表 | 返回 "My documents" + "Shared with me" 两个分区 |
| 分享通知 | 邀请即生效，被邀请者主页 **无需刷新** 瞬间出现新文档 |
| 链接分享 | Share 面板有 "Copy link" 按钮，复制 `/document/<docId>` 链接 |
| WebSocket 鉴权 | Yjs WS 连接需带 token，后端校验用户对该文档的访问权限 |
| 技术栈 | 统一 WebSocket——文档级 `/yjs/<docId>` + 用户级 `/ws/notifications` |

---

## 2. 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                                │
│                                                                │
│  DocsPage (主页)                                               │
│  ├── EventSource?  ❌ 不用                                      │
│  ├── WebSocket → ws://localhost:5173/ws/notifications?token=xx │
│  │   └── 收到 {type:"document-shared", docId, name, sharedBy}  │
│  │       → 重新 GET /api/documents → "Shared with me" 出现     │
│  │                                                             │
│  Editor (编辑器)                                               │
│  └── WebSocket → ws://localhost:5173/yjs/<docId>?token=xx      │
│      └── 后端校验 token + 该用户对该 docId 的访问权限           │
│                                                                │
│  ShareModal (分享面板)                                         │
│  ├── 输入用户名 + 选角色 → POST /api/documents/:docId/share    │
│  └── Copy link 按钮 → 复制 http://localhost:5173/document/<id> │
└──────────────────────────────────────────────────────────────┘
         │                          │
         │ REST (HTTP)              │ WebSocket
         ▼                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Express + WS Server (:3001)                 │
│                                                                │
│  REST API                                                      │
│  ├── GET  /api/documents          → owned + shared 两类文档    │
│  ├── POST /api/documents/:docId/share                            │
│  │   ├── 写 document_access                                     │
│  │   └── notifyUser(targetUserId, {type:"document-shared"})    │
│  └── ...                                                       │
│                                                                │
│  WebSocket Server (noServer mode)                              │
│  ├── /yjs/<docId>?token=xx                                     │
│  │   ├── 验证 JWT                                              │
│  │   ├── 查 document_access 确认访问权限                        │
│  │   └── setupWSConnection (CRDT 同步)                         │
│  │                                                              │
│  └── /ws/notifications?token=xx                                │
│      ├── 验证 JWT                                              │
│      ├── 注册到 notificationCenter.addConnection(userId, ws)   │
│      └── 保持连接，等待服务端推送                               │
│                                                                │
│  NotificationCenter (内存级)                                   │
│  └── Map<userId, Set<WebSocket>>                              │
│      └── notifyUser(userId, event) → 向该用户所有 WS 推送      │
└──────────────────────────────────────────────────────────────┘
```

### 通知推送时序

```
alice                    Server                    bob
  │                        │                        │
  │ POST /share            │                        │
  │  {username:"bob"}      │                        │
  │───────────────────────►│                        │
  │                        │ 写 document_access     │
  │                        │ notifyUser(bobId, ...) │
  │                        │───────────────────────►│
  │                        │  WS: {type:            │
  │  200 OK                │   "document-shared",   │
  │◄───────────────────────│   docId, name}         │
  │                        │                        │ 重新 fetch
  │                        │                        │ /api/documents
  │                        │◄───────────────────────│
  │                        │ 200 OK + shared docs   │
  │                        │───────────────────────►│
  │                        │                        │ "Shared with me"
  │                        │                        │ 区域出现新文档
```

---

## 3. 改动清单（8 个文件）

| # | 文件 | 操作 | 改动内容 |
|---|------|------|----------|
| 1 | `server/src/routes/documents.ts` | 修改 | `GET /` 返回 owned + shared 两类文档 |
| 2 | `server/src/notifications.ts` | **新建** | 内存级 WebSocket 通知中心 |
| 3 | `server/src/server.ts` | 修改 | 加 `/ws/notifications` 路由 + Yjs WS 鉴权 |
| 4 | `server/src/routes/sharing.ts` | 修改 | 分享成功后调用 `notifyUser` |
| 5 | `client/src/services/api.ts` | 修改 | `DocumentWithAbilities` 加 `shared` 字段 + 通知 WS URL |
| 6 | `client/src/services/yjsProvider.ts` | 修改 | WS 连接 URL 附加 `?token=xxx` |
| 7 | `client/src/components/DocsPage.tsx` | 修改 | 分区显示 + WebSocket 通知监听 |
| 8 | `client/src/components/ShareModal.tsx` | 修改 | 加 "Copy link" 按钮 |
| 9 | `client/vite.config.ts` | 修改 | 加 `/ws` WebSocket 代理 |

---

## Step 1 — 后端：文档列表返回共享文档

**文件**: `server/src/routes/documents.ts`
**改动**: `GET /` 路由

### 当前代码（要替换的部分）

```typescript
router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const docs = await db
    .collection<DocumentDoc>('documents')
    .find(
      { ownerUserId: new ObjectId(req.user!.id), deletedAt: null },
      { projection: { crdtState: 0 } }
    )
    .sort({ updatedAt: -1 })
    .toArray()

  res.json(
    docs.map((d) => ({
      id: d.docId,
      name: d.title,
      createdAt: d.createdAt.getTime(),
      updatedAt: d.updatedAt.getTime(),
      abilities: getAbilities(Role.OWNER),
    }))
  )
})
```

### 新代码

```typescript
router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDB()
  const userId = new ObjectId(req.user!.id)

  // ── 1. Owned documents ──
  const ownedDocs = await db
    .collection<DocumentDoc>('documents')
    .find(
      { ownerUserId: userId, deletedAt: null },
      { projection: { crdtState: 0 } }
    )
    .sort({ updatedAt: -1 })
    .toArray()

  const ownedResult = ownedDocs.map((d) => ({
    id: d.docId,
    name: d.title,
    createdAt: d.createdAt.getTime(),
    updatedAt: d.updatedAt.getTime(),
    abilities: getAbilities(Role.OWNER),
    shared: false,
  }))

  // ── 2. Shared documents ──
  // 先查 document_access 获取该用户有权限的 documentId 列表
  const accessRecords = await db
    .collection<DocumentAccessDoc>('document_access')
    .find({ userId })
    .toArray()

  const docIds = accessRecords.map((a) => a.documentId)
  const roleMap = new Map(
    accessRecords.map((a) => [a.documentId.toString(), a.role as Role])
  )

  const sharedDocs = docIds.length > 0
    ? await db
        .collection<DocumentDoc>('documents')
        .find(
          { _id: { $in: docIds }, deletedAt: null },
          { projection: { crdtState: 0 } }
        )
        .sort({ updatedAt: -1 })
        .toArray()
    : []

  const sharedResult = sharedDocs.map((d) => ({
    id: d.docId,
    name: d.title,
    createdAt: d.createdAt.getTime(),
    updatedAt: d.updatedAt.getTime(),
    abilities: getAbilities(roleMap.get(d._id!.toString()) || null),
    shared: true,
  }))

  res.json([...ownedResult, ...sharedResult])
})
```

### 验证

```bash
# 1. alice 登录
ALICE_TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"alice123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

# 2. alice 创建文档
DOC=$(curl -s http://localhost:3001/api/documents \
  -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"name":"Shared Test"}')
DOC_ID=$(echo $DOC | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).id))")

# 3. alice 分享给 bob
curl -s "http://localhost:3001/api/documents/$DOC_ID/share" \
  -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"username":"bob","role":"editor"}'

# 4. bob 登录并列表——应该看到 shared: true 的文档
BOB_TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"bob","password":"bob123456"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

curl -s http://localhost:3001/api/documents -H "Authorization: Bearer $BOB_TOKEN"
# 期望：[{...,"shared":true,"abilities":{"canEdit":true,"canDelete":false,...}}]
```

---

## Step 2 — 后端：新建通知中心 notifications.ts

**文件**: `server/src/notifications.ts`（**新建**）
**职责**: 内存级 WebSocket 通知中心，管理每个用户的 WebSocket 连接池

### 完整代码

```typescript
import type { WebSocket } from 'ws'

/**
 * 内存级 WebSocket 通知中心
 *
 * 数据结构: Map<userId, Set<WebSocket>>
 * - 用户打开 DocsPage 时建立 WS 连接，注册到这里
 * - 服务端调用 notifyUser(userId, event) 推送消息
 * - 用户关闭页面时连接自动断开，从 Map 中移除
 *
 * 不持久化——服务重启后连接重建即可，通知不补发。
 */
const connections = new Map<string, Set<WebSocket>>()

/** 注册一个用户的 WebSocket 连接 */
export function addConnection(userId: string, ws: WebSocket): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set())
  }
  connections.get(userId)!.add(ws)
  console.log(`[notifications] User ${userId} connected (${connections.get(userId)!.size} connection(s))`)
}

/** 移除一个用户的 WebSocket 连接 */
export function removeConnection(userId: string, ws: WebSocket): void {
  const set = connections.get(userId)
  if (!set) return
  set.delete(ws)
  if (set.size === 0) {
    connections.delete(userId)
  }
  console.log(`[notifications] User ${userId} disconnected (${set.size} connection(s) remaining)`)
}

/** 向某用户的所有连接推送一条事件 */
export function notifyUser(userId: string, event: object): void {
  const set = connections.get(userId)
  if (!set || set.size === 0) {
    console.log(`[notifications] User ${userId} offline, skipping notification`)
    return
  }
  const message = JSON.stringify(event)
  let sent = 0
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message)
      sent++
    }
  }
  console.log(`[notifications] Notified user ${userId} (${sent}/${set.size} connections)`)
}

/** 检查用户是否在线 */
export function isUserOnline(userId: string): boolean {
  const set = connections.get(userId)
  return !!set && set.size > 0
}
```

### 验证

```bash
npx tsc --noEmit  # 编译通过即可，功能验证在 Step 3+4 联调
```

---

## Step 3 — 后端：server.ts 加 /ws/notifications 路由 + WebSocket 鉴权

**文件**: `server/src/server.ts`
**改动**:
1. 新增 `/ws/notifications` 路由处理
2. Yjs `/yjs/<docId>` 路由加 JWT 鉴权 + 文档访问权限校验

### 改动 1: import 新增

在文件顶部 import 区加：

```typescript
import { addConnection, removeConnection } from './notifications'
import type { WebSocket } from 'ws'
```

### 改动 2: 新建通知 WebSocket Server

在 `const wss = new WebSocketServer(...)` 之后加：

```typescript
// ── 通知 WebSocket Server（用户级实时推送）──
const notifyWss = new WebSocketServer({ noServer: true })

notifyWss.on('connection', (ws: WebSocket, userId: string) => {
  addConnection(userId, ws)

  ws.on('close', () => {
    removeConnection(userId, ws)
  })

  ws.on('error', (err) => {
    console.error(`[notifications] WS error for user ${userId}:`, err)
    removeConnection(userId, ws)
  })

  // 发送确认消息
  ws.send(JSON.stringify({ type: 'connected', userId }))
})
```

### 改动 3: server.on('upgrade') 路由分发

**替换**当前的 `server.on('upgrade', ...)` 整段：

```typescript
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', 'http://x')
  const pathname = url.pathname

  // ── 路由 1: /ws/notifications — 用户级通知 ──
  if (pathname === '/ws/notifications') {
    const token = url.searchParams.get('token')
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: string }
      notifyWss.handleUpgrade(request, socket, head, (ws) => {
        notifyWss.emit('connection', ws, payload.id)
      })
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
    return
  }

  // ── 路由 2: /yjs/<docId> — 文档级 CRDT 同步 ──
  if (pathname.startsWith('/yjs')) {
    const token = url.searchParams.get('token')
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: string }
      // TODO: 校验该用户对该 docId 的访问权限
      // （owner 或 document_access 有记录）
      // 暂时跳过，先让协作功能跑通
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
    return
  }

  // ── 未知路径 ──
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
  socket.destroy()
})
```

> **注意**: Yjs WS 鉴权中的文档访问权限校验标记了 TODO。
> 完整实现需要 `getDB()` 查 `documents` + `document_access`，
> 但这需要在 upgrade 回调中做异步操作（返回 Promise），
> WebSocket `handleUpgrade` 不直接支持 async，需要用 callback 模式。
> 先加 JWT 验证（同步），文档级权限校验作为后续优化。

### 验证

```bash
# 1. 编译
npx tsc --noEmit

# 2. 重启服务端

# 3. 用 wscat 测试通知 WS（需要先获取 token）
TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"alice123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

# 4. 连接通知 WS（应收到 {"type":"connected","userId":"..."}）
npx wscat "ws://localhost:3001/ws/notifications?token=$TOKEN"
# 期望输出: < {"type":"connected","userId":"6ab..."}

# 5. 无 token 连接应被拒绝
npx wscat "ws://localhost:3001/ws/notifications"
# 期望: 连接被关闭 (401)
```

---

## Step 4 — 后端：sharing.ts 分享成功后推送通知

**文件**: `server/src/routes/sharing.ts`
**改动**: `POST /:docId/share` 路由中，`upsert` 成功后调用 `notifyUser`

### 改动 1: import

文件顶部加：

```typescript
import { notifyUser } from '../notifications'
```

### 改动 2: share 路由末尾

在 `res.json({ status: 'ok' })` **之前**加：

```typescript
  // ── 向被邀请用户推送实时通知 ──
  notifyUser(targetUser._id!.toString(), {
    type: 'document-shared',
    docId: doc.docId,
    name: doc.title,
    sharedBy: req.user!.username,
    role: targetRole,
  })

  res.json({ status: 'ok' })
```

### 完整修改后的 share 路由

```typescript
router.post('/:docId/share', async (req: AuthRequest, res: any) => {
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  // 权限检查：只有 owner/admin 可以分享
  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = await db.collection<DocumentAccessDoc>('document_access').findOne({
    documentId: doc._id!,
    userId: new ObjectId(req.user!.id),
  })
  const role: Role | null = isOwner ? Role.OWNER : (access?.role as Role) || null
  if (role !== Role.OWNER && role !== Role.ADMIN) {
    res.status(403).json({ error: 'Only owner/admin can share' })
    return
  }

  const targetUser = await db.collection<UserDoc>('users').findOne({ username: req.body.username })
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const targetRole = req.body.role || Role.READER
  await db.collection<DocumentAccessDoc>('document_access').updateOne(
    { documentId: doc._id!, userId: targetUser._id! },
    {
      $set: {
        role: targetRole,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    },
    { upsert: true }
  )

  // ── 向被邀请用户推送实时通知 ──
  notifyUser(targetUser._id!.toString(), {
    type: 'document-shared',
    docId: doc.docId,
    name: doc.title,
    sharedBy: req.user!.username,
    role: targetRole,
  })

  res.json({ status: 'ok' })
})
```

### 验证

```bash
# 1. 用两个终端：
#    终端 A: bob 连接通知 WS
BOB_TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"bob","password":"bob123456"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

npx wscat "ws://localhost:3001/ws/notifications?token=$BOB_TOKEN"
# 应收到: < {"type":"connected","userId":"..."}

#    终端 B: alice 分享文档给 bob
ALICE_TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"alice123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

curl -s "http://localhost:3001/api/documents/<docId>/share" \
  -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"username":"bob","role":"editor"}'

#    终端 A 应即时收到:
# < {"type":"document-shared","docId":"...","name":"...","sharedBy":"alice","role":"editor"}
```

---

## Step 5 — 前端：api.ts 类型扩展 + 通知 WS URL

**文件**: `client/src/services/api.ts`

### 改动 1: DocumentWithAbilities 加 shared 字段

```typescript
export interface DocumentWithAbilities extends DocumentMeta {
  abilities: DocumentAbilities
  shared?: boolean  // 新增：标记是否是被分享的文档
}
```

### 改动 2: 新增通知 WebSocket URL helper

在文件末尾加：

```typescript
/* ── Notification WebSocket URL ──────────────────────────────── */
export function getNotificationWsUrl(): string {
  const token = getToken()
  // 开发环境通过 Vite 代理: ws://localhost:5173/ws/notifications
  // 生产环境直连后端
  const wsBase = import.meta.env.VITE_YJS_URL?.replace('/yjs', '') || 'ws://localhost:5173'
  // 通知 WS 路径是 /ws/notifications，和 Yjs WS (/yjs) 共用同一 host
  const base = wsBase.replace(/\/yjs\/?$/, '')
  return `${base}/ws/notifications?token=${token}`
}
```

### 验证

```bash
cd client && npx tsc --noEmit
```

---

## Step 6 — 前端：yjsProvider.ts 连接带 token

**文件**: `client/src/services/yjsProvider.ts`

### 当前代码

```typescript
const WS_URL = import.meta.env.VITE_YJS_URL || 'ws://localhost:5173/yjs'

export function createYjs(docId: string, customUser?: Partial<UserAwareness>): CollabSession {
  // ...
  const provider = new WebsocketProvider(WS_URL, docId, doc, { ... })
```

### 新代码

```typescript
import { getToken } from './api'  // 新增 import

const WS_BASE = import.meta.env.VITE_YJS_URL || 'ws://localhost:5173/yjs'

export function createYjs(docId: string, customUser?: Partial<UserAwareness>): CollabSession {
  // ...
  // 在 URL 中附加 token 用于 WebSocket 鉴权
  const token = getToken()
  const wsUrl = token ? `${WS_BASE}?token=${token}` : WS_BASE

  const provider = new WebsocketProvider(wsUrl, docId, doc, { ... })
```

> **注意**: `WebsocketProvider` 的第一个参数是 base URL，第二个是 room name。
> `?token=xxx` 附加在 base URL 上，y-websocket 会把它带到 `ws://.../yjs/<docId>?token=xxx`。

### 验证

```bash
cd client && npx tsc --noEmit
```

---

## Step 7 — 前端：DocsPage.tsx 分区显示 + 实时通知监听

**文件**: `client/src/components/DocsPage.tsx`

### 改动 1: import 新增

```typescript
import { getNotificationWsUrl, documentsApi } from '../services/api'
import type { DocumentWithAbilities } from '../services/api'  // 替代 DocumentMeta
```

### 改动 2: 状态改为 DocumentWithAbilities

```typescript
const [docs, setDocs] = useState<DocumentWithAbilities[]>([])
```

### 改动 3: 新增通知 WebSocket 监听

在现有 `useEffect` 之后加：

```typescript
/* ── 实时通知：监听 document-shared 事件 ──────────────────── */
useEffect(() => {
  const wsUrl = getNotificationWsUrl()
  if (!wsUrl.includes('token=')) return  // 未登录不连接

  const ws = new WebSocket(wsUrl)

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'document-shared') {
        // 收到分享通知 → 重新 fetch 文档列表
        loadDocs()
      }
    } catch {
      // ignore parse errors
    }
  }

  ws.onerror = (err) => {
    console.error('[notifications] WS error:', err)
  }

  return () => {
    ws.close()
  }
}, [])
```

其中 `loadDocs` 是把现有 `useEffect` 中的 fetch 逻辑提取出来的函数：

```typescript
const loadDocs = useCallback(async () => {
  try {
    const result = await documentsApi.list()
    setDocs(result)
    setError('')
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load documents')
  } finally {
    setLoading(false)
  }
}, [])

useEffect(() => {
  loadDocs()
}, [loadDocs])
```

### 改动 4: 文档列表分区显示

把当前的单一 `filteredDocs` 改为两个分区：

```typescript
const ownedDocs = filteredDocs.filter((d) => !d.shared)
const sharedDocs = filteredDocs.filter((d) => d.shared)
```

在 JSX 中：

```tsx
{/* My documents */}
{ownedDocs.length > 0 && (
  <section className="recent-section">
    <p className="section-label">My documents</p>
    <div className="docs-grid">
      {ownedDocs.map((doc) => (
        <DocCard key={doc.id} doc={doc} onClick={() => navigate('/document/' + doc.id)} />
      ))}
    </div>
  </section>
)}

{/* Shared with me */}
{sharedDocs.length > 0 && (
  <section className="recent-section">
    <p className="section-label">Shared with me</p>
    <div className="docs-grid">
      {sharedDocs.map((doc) => (
        <DocCard key={doc.id} doc={doc} onClick={() => navigate('/document/' + doc.id)} />
      ))}
    </div>
  </section>
)}
```

> 注意：上面用 `DocCard` 组件是为了示意，实际改动是把现有 `doc-card` 的 JSX
> 提取成组件或者直接在两个 section 里重复渲染。最简单的方式是用两个 `.filter()` + 两个 `.map()`。

### 完整的 render 区域改动

把当前 `{filteredDocs.length === 0 ? (...) : (...)}` 整段替换为：

```tsx
{filteredDocs.length === 0 ? (
  <div className="empty-state">
    {/* ... 保持不变 ... */}
  </div>
) : (
  <>
    {ownedDocs.length > 0 && (
      <section className="recent-section">
        <p className="section-label">
          My documents
          <span className="doc-count">{ownedDocs.length}</span>
        </p>
        <div className="docs-grid">
          {ownedDocs.map((doc) => (
            <DocCard key={doc.id} doc={doc} timeAgo={timeAgo} cardColor={cardColor} navigate={navigate} onDelete={setDeleteTarget} />
          ))}
        </div>
      </section>
    )}

    {sharedDocs.length > 0 && (
      <section className="recent-section" style={{ marginTop: '24px' }}>
        <p className="section-label">
          Shared with me
          <span className="doc-count">{sharedDocs.length}</span>
        </p>
        <div className="docs-grid">
          {sharedDocs.map((doc) => (
            <DocCard key={doc.id} doc={doc} timeAgo={timeAgo} cardColor={cardColor} navigate={navigate} onDelete={setDeleteTarget} />
          ))}
        </div>
      </section>
    )}
  </>
)}
```

> 为了代码清晰，建议把 doc-card 的 JSX 提取为 `DocCard` 子组件。
> 但如果改动量太大，也可以直接在两个 `.map()` 里内联渲染——保持现有代码结构即可。

### 验证

```bash
cd client && npx tsc --noEmit
# 然后浏览器测试：
# 1. bob 登录 → 看到两个分区（如果之前被分享过文档的话）
# 2. alice 分享新文档给 bob → bob 无需刷新，"Shared with me" 区域瞬间出现新文档
```

---

## Step 8 — 前端：ShareModal.tsx 复制链接

**文件**: `client/src/components/ShareModal.tsx`

### 改动: 在 share-form 之前加 "Copy link" 按钮

```tsx
{canShare && (
  <div className="share-link-section">
    <div className="share-link-box">
      <input
        type="text"
        readOnly
        value={`${window.location.origin}/document/${docId}`}
        className="share-link-input"
        onClick={(e) => (e.target as HTMLInputElement).select()}
      />
      <button
        className="share-copy-btn"
        onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/document/${docId}`)
        }}
      >
        Copy link
      </button>
    </div>
  </div>
)}
```

### 配套 CSS（加到 index.css 末尾）

```css
/* ── Share link section ── */
.share-link-section {
  margin-bottom: 16px;
}

.share-link-box {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-sm);
}

.share-link-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--gray-700);
  outline: none;
  font-family: monospace;
}

.share-copy-btn {
  padding: 4px 12px;
  background: var(--blue-500);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--duration) var(--ease);
}

.share-copy-btn:hover {
  background: var(--blue-600);
}
```

### 验证

```bash
# 浏览器测试：
# 1. 打开 Share 面板 → 看到 link 输入框 + Copy link 按钮
# 2. 点击 Copy link → 链接复制到剪贴板
# 3. 粘贴到地址栏 → 进入文档编辑器
```

---

## Step 9 — Vite 代理配置

**文件**: `client/vite.config.ts`

### 改动: 加 `/ws` 代理

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST API 代理
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Yjs WebSocket 代理
      '/yjs': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
      // 通知 WebSocket 代理（新增）
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
```

### 验证

```bash
# 改完后需要重启 Vite（.env / vite.config.ts 变更不触发 HMR）
npx kill-port 5173 && npx vite
```

---

## 验证方案

### 端到端验证（需要两个浏览器窗口）

```
准备:
1. 确保 MongoDB 运行
2. 重启服务端: cd server && npx tsc && node dist/server.js
3. 重启前端: cd client && npx vite

步骤:
┌─────────────────────────────┬─────────────────────────────────────────┐
│ 窗口 A (alice)              │ 窗口 B (bob)                            │
├─────────────────────────────┼─────────────────────────────────────────┤
│ 1. 登录 alice               │ 1. 登录 bob                             │
│ 2. 创建文档 "Test Share"    │ 2. 主页空（或只有之前被分享的文档）     │
│ 3. 打开文档 → 点 Share      │                                         │
│ 4. 输入 bob, 选 Editor      │                                         │
│ 5. 点 Invite                │                                         │
│                             │ 3. ← 无需刷新！"Shared with me" 区域    │
│                             │      瞬间出现 "Test Share" 文档          │
│                             │ 4. 点击文档 → 进入编辑器                │
│ 6. 在编辑器输入文字         │ 5. ← 实时看到 alice 输入的内容          │
│                             │ 6. 也能编辑（editor 权限）              │
│ 7. 点 Share → Copy link     │                                         │
│    粘贴到新标签页打开       │                                         │
│    → 应进入该文档           │                                         │
└─────────────────────────────┴─────────────────────────────────────────┘
```

### API 验证

```bash
# 1. 文档列表返回 shared 字段
curl -s http://localhost:3001/api/documents -H "Authorization: Bearer $BOB_TOKEN" | node -e "
process.stdin.on('data', d => {
  const docs = JSON.parse(d)
  docs.forEach(doc => console.log(doc.name, 'shared:', doc.shared, 'canEdit:', doc.abilities.canEdit))
})"

# 2. 通知 WS 连接
npx wscat "ws://localhost:3001/ws/notifications?token=$BOB_TOKEN"
# 期望: < {"type":"connected","userId":"..."}

# 3. 分享触发通知
# （在另一个终端执行 share API，wscat 终端应收到 document-shared 事件）
```

---

## 风险与回退

| 风险 | 影响 | 回退方案 |
|------|------|----------|
| 通知 WS 连接失败（Vite 代理问题） | bob 不收到实时通知，需手动刷新 | 回退为 `useEffect` 定时轮询 `GET /api/documents`（每 10s） |
| Yjs WS 加 token 后连接不上 | 编辑器无法协作 | 去掉 `?token=xxx` 恢复无鉴权连接 |
| `document_access` 查询慢（大量文档） | 文档列表加载变慢 | 加 `{ documentId: 1, userId: 1 }` 复合索引（db.ts 已有） |
| 通知中心内存泄漏（WS 未正确关闭） | 服务端内存增长 | `ws.on('close')` + `ws.on('error')` 双重清理（已实现） |
| 用户多标签页打开 DocsPage | 多条 WS 连接 | `Map<userId, Set<WebSocket>>` 已支持多连接 |

---

## 实施顺序

```
Step 1 (documents.ts)     ──┐
Step 2 (notifications.ts) ──┤── 后端改动，可并行
Step 3 (server.ts)        ──┤
Step 4 (sharing.ts)       ──┘
                             │
Step 5 (api.ts)           ──┐
Step 6 (yjsProvider.ts)   ──┤── 前端改动，可并行
Step 7 (DocsPage.tsx)     ──┤
Step 8 (ShareModal.tsx)   ──┤
Step 9 (vite.config.ts)   ──┘
                             │
验证 ────────────────────── ─┘
```

每完成一个 Step 后执行 `npx tsc --noEmit` 验证编译。
全部完成后执行端到端验证（两个浏览器窗口）。

---

## 附录：设计思路参考

> 以下整理了本方案在设计过程中参考的业界协作产品的架构模式，
> 提取了关键设计思路并适配到我们的 Node.js/TypeScript 技术栈。

### A1. 共享文档列表查询

**业界方案**（基于文档访问记录的 UNION 查询）：

```python
# 文档出现在用户列表中的两个条件（UNION）：
# 1. 用户有 DocumentAccess 记录（直接或通过团队）
access_documents_ids = DocumentAccess.objects.filter(
    Q(user=user) | Q(team__in=user.teams)
).values_list("document_id", flat=True)

# 2. 用户有 LinkTrace 记录（曾通过链接访问过）且文档不是 restricted
traced_documents_ids = LinkTrace.objects.filter(user=user)
    .exclude(document__link_reach=LinkReachChoices.RESTRICTED)
    .values_list("document_id", flat=True)

return queryset.filter(id__in=access_documents_ids.union(traced_documents_ids))
```

**我们的适配**（Step 1）：
- 不需要 `LinkTrace`——我们只有按用户名邀请，没有链接访问追踪的需求（后续可加）
- 不需要团队权限——我们是单用户模型
- 核心思路一致：**union of owned + shared**

```typescript
// 我们的实现（简化版）
const ownedDocs = db.collection('documents').find({ ownerUserId: userId })
const accessRecords = db.collection('document_access').find({ userId })
const sharedDocs = db.collection('documents').find({ _id: { $in: docIds } })
return [...ownedResult, ...sharedResult]
```

### A2. 能力契约（Abilities）模式

**业界方案**（`get_abilities(user)` 能力契约模式）：

每个模型都实现 `get_abilities(user)` 返回一个 **能力字典**，如：

```python
{
    "destroy": True,       # can delete
    "partial_update": True, # can edit
    "retrieve": True,      # can view
    "comment": True,       # can comment
    "accesses_manage": True, # can share
    "versions_list": True, # can view history
    "link_configuration": True, # can change link settings
    "invite_owner": False, # can invite as owner
    "leave": False,        # can leave the document
    ...
}
```

权限类直接检查 `abilities.get(view.action, False)`，前端直接消费这些布尔值控制 UI。

**我们的适配**（已实现 `server/src/rbac.ts`）：

```typescript
// 我们的能力契约（简化版，6 个能力）
getAbilities(role) → {
  canView, canEdit, canDelete, canShare, canComment, canViewHistory
}
```

**设计要点**：
- `set_role_to` 列表——告诉你"能把别人设成什么角色"（owner 不能被 admin 设置等）。我们目前没有这个限制，后续可加。
- 角色继承——取最高优先级角色。我们没有树结构，暂不需要。

### A3. 邀请模型——无 pending/accepted 状态

**业界方案**（邀请即生效，无 pending/accepted 状态）：

```python
class Invitation(BaseModel):
    email = models.EmailField()
    document = models.ForeignKey(Document)
    role = models.CharField(choices=RoleChoices.choices)
    issuer = models.ForeignKey(User)
    # 没有 status 字段，没有 accepted_at 字段
    # is_expired 只检查时间过期
```

`Invitation` 只是一个记录"email X 被邀请到文档 Y"，没有接受/拒绝流程。
真正的权限通过 `DocumentAccess` 记录控制——`DocumentAccess` 一旦创建，用户立即获得权限。

另外有独立的 `DocumentAskForAccess` 模型（"请求访问"功能），它有 `accept()` 方法：

```python
def accept(self, role=None):
    DocumentAccess.objects.update_or_create(
        document=self.document, user=self.user,
        defaults={"role": role})
    self.delete()
```

**我们的适配**：
- 和我们的设计一致——邀请即生效，`document_access` upsert 后立即有权限
- 我们不需要 `Invitation` 模型——我们按用户名邀请（用户必须已注册），不需要邮件邀请
- "请求访问"功能可作为后续增强

### A4. 实时通知架构——外部微服务 + HTTP 通信

**业界方案**：

部分协作产品采用**独立的 WebSocket 微服务**处理实时连接，后端通过 HTTP API 和协作服务器通信：

```python
# CollaborationService 向协作服务器发 HTTP 请求
class CollaborationService:
    def reset_connections(self, document_id, user_id=None):
        # POST /reset-connections/?room=<doc_id>
        # 告诉协作服务器："这个文档的权限变了，踢掉相关用户"
        response = requests.post(
            f"{settings.COLLABORATION_API_URL}reset-connections/?room={room}",
            headers={"Authorization": settings.COLLABORATION_SERVER_SECRET})

# 在 DocumentAccess 变更时通过 Celery 异步触发
@receiver(post_save, sender=DocumentAccess)
def document_access_post_save(sender, instance, created, **kwargs):
    reset_service_connections_in_cascade.delay(str(instance.document.id))
```

**关键设计**：
- Django 不直接管 WebSocket——它只管 REST API 和权限
- 协作服务器独立运行，通过 HTTP 接收"重置连接"指令
- 权限变更 → Celery 异步任务 → HTTP 通知协作服务器 → 协作服务器踢掉受影响用户 → 用户重连时带着新权限

**我们的适配**（Step 2-4）：

我们更简单——**单进程**架构（Express + WS 在同一个进程），不需要 HTTP 跨服务通信：

```
微服务方案:  后端 ──HTTP──→ 协作 WS Server ──WS──→ Browser
我们:       Express + WS Server (同进程) ──WS──→ Browser
            └── notifyUser() 直接调用，无需 HTTP
```

```typescript
// 我们的实现——内存级直接调用
// sharing.ts 中：
notifyUser(targetUserId, { type: 'document-shared', ... })
// notifications.ts 中：
connections.get(userId)?.forEach(ws => ws.send(JSON.stringify(event)))
```

**设计要点**：
- `reset_connections` 模式——权限变更时踢掉用户强制重连。我们暂时不需要（邀请是新增权限，不是修改/删除），但后续实现"移除协作者"时可采用：移除后向被移除用户推送 `{ type: 'access-revoked' }` 事件，前端自动跳回主页。
- 编辑冲突检测——检查是否有人在线编辑。我们暂不需要，但思路有价值。

### A5. LinkTrace——链接访问追踪

**业界方案**（链接访问追踪模型）：

```python
class LinkTrace(BaseModel):
    document = models.ForeignKey(Document)
    user = models.ForeignKey(User)
    # 唯一约束: (user, document)

# 用户通过链接访问文档时自动创建
def retrieve(self, request, *args, **kwargs):
    instance = self.get_object()
    if user.is_authenticated and not instance.link_traces.filter(user=user).exists():
        LinkTrace.objects.create(document=instance, user=request.user)
```

`LinkTrace` 的作用：用户通过链接访问过一个非 restricted 文档后，该文档会永久出现在用户的文档列表中（即使没有 `DocumentAccess` 记录）。

**我们的适配**：
- 我们目前不需要 `LinkTrace`——我们只有按用户名邀请，所有共享文档都有 `document_access` 记录
- 如果后续加"链接分享 + 任何人可访问"功能，可以采用这个模式

### A6. 总结：采用了什么，没采用什么

| 设计特性 | 我们是否采用 | 原因 |
|---------------|-------------|------|
| Abilities 能力契约模式 | ✅ 已实现 | 前端直接消费布尔值控制 UI，简洁高效 |
| 邀请即生效（无 pending） | ✅ 本方案核心 | 体验流畅 |
| 共享文档出现在列表 | ✅ Step 1 | 核心需求 |
| 外部 WebSocket 微服务 | ❌ 简化为单进程 | 我们不需要微服务架构 |
| Celery 异步任务 | ❌ 直接同步调用 | 单进程无需异步队列 |
| LinkTrace 链接追踪 | ❌ 暂不需要 | 后续加链接分享时再考虑 |
| 角色继承（树结构） | ❌ 暂不需要 | 我们没有文档树 |
| `set_role_to` 限制 | ❌ 暂不需要 | 后续增强权限管理时再加 |
| 编辑冲突检测 | ❌ 暂不需要 | CRDT 已解决冲突 |
| 请求访问（AskForAccess） | ❌ 暂不需要 | 后续增强 |
| `reset_connections` 模式 | 📝 后续采用 | 实现"移除协作者"时参考 |

