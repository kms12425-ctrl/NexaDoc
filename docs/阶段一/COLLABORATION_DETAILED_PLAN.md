# 阶段一：协作层（在线编辑）详细迁移计划

## 背景：当前协作链路的问题

迁移前项目同时使用 Socket.IO（文本变更广播）和 Yjs WebSocket（CRDT 同步 + awareness）双通道。经分析，Yjs WebSocket 通道存在以下问题，导致 CRDT 同步实际未生效，实时协作依赖 Socket.IO 广播：

### 问题 1：后端路径精确匹配导致连接被拒

服务端 upgrade 处理使用 `pathname === '/yjs'` 精确匹配，而客户端连接的是 `ws://localhost:3001/yjs/<docId>`，pathname 为 `/yjs/<docId>`，精确匹配不通过 → Yjs WebSocket 连接被拒。

### 问题 2：开发模式直连后端绕过 Vite 代理

客户端在 dev 模式下直连后端端口，绕过 Vite 代理。这要求开发者手动对齐端口，且生产模式下若前后端不同源则连接失败。

### 验证结论

迁移前的实时同步实际上是：
- **文本变更**：Socket.IO `send-changes` → `receive-changes`（工作正常）
- **CRDT 同步**：Yjs WebSocket 连接失败（pathname 精确匹配不通过）
- **光标/awareness**：可能靠 BroadcastChannel（同浏览器跨标签同步，不跨设备）

迁移到 TipTap 后，必须重新设计连接链路，确保 Yjs WebSocket 正常工作。

---

## 迁移后的连接链路设计

### 设计原则

1. **一条 WebSocket 通道**：只用 Yjs WebSocket，移除 Socket.IO
2. **通过 Vite 代理**：开发模式下客户端连 Vite（5173），Vite 代理到后端（3001），不直连后端
3. **路径清晰**：用 `/yjs/<docName>` 路径格式，Vite 代理匹配 `/yjs` 前缀
4. **后端路径过滤**：只处理以 `/yjs` 开头的 upgrade 请求
5. **docName 从 URL 提取**：从 path 中剥离 `/yjs/` 前缀得到 docName

### 数据流设计

```
开发模式 (dev):

客户端 (浏览器)
  │
  │  new WebsocketProvider('ws://localhost:5173/yjs', docId, ydoc)
  │  → 内部 URL = ws://localhost:5173/yjs/<docId>
  │
  ↓ WebSocket 升级请求: GET /yjs/<docId>  Host: localhost:5173

Vite Dev Server (端口 5173)
  │
  │  vite.config.ts proxy:
  │    '/yjs': { target: 'ws://localhost:3001', ws: true, changeOrigin: true }
  │
  │  匹配 /yjs 前缀 → 代理到 ws://localhost:3001
  │  转发请求: GET /yjs/<docId>  Host: localhost:3001
  │
  ↓

后端 (端口 3001)
  │
  │  server.on('upgrade', (request, socket, head) => {
  │    const pathname = new URL(request.url, 'http://x').pathname
  │    // pathname = '/yjs/<docId>'
  │    if (pathname.startsWith('/yjs')) {     ← 前缀匹配，不是精确匹配
  │      wss.handleUpgrade(request, socket, head, (ws) => {
  │        wss.emit('connection', ws, request)
  │      })
  │    }
  │  })
  │
  │  wss.on('connection', (ws, req) => {
  │    // req.url = '/yjs/<docId>'
  │    // 提取 docName: 剥离 '/yjs/' 前缀
  │    const docName = req.url.slice(1).split('?')[0].replace(/^yjs\//, '')
  │    // docName = '<docId>'
  │    setupWSConnection(ws, req, { docName })
  │  })
  │
  └── setupWSConnection:
        → getYDoc(docName) → 创建或获取内存中的 Y.Doc
        → 绑定 conn 到 doc → CRDT 同步开始
        → awareness 广播


生产模式 (build):

客户端 (浏览器)
  │
  │  new WebsocketProvider('ws://<host>/yjs', docId, ydoc)
  │  → 内部 URL = ws://<host>/yjs/<docId>
  │
  ↓ WebSocket 升级请求: GET /yjs/<docId>

后端 (端口 3001, 同时 serve 静态文件)
  │
  │  同上处理 → setupWSConnection
  │
  └── CRDT 同步 + awareness
```

### 目标连接链路参数

| 对比项 | 目标设计 |
|---|---|
| 客户端 WS URL | `ws://localhost:5173/yjs` (dev，通过 Vite 代理) / `ws://<host>/yjs` (prod) |
| Vite WS 代理 | `/yjs` → 3001 |
| 后端端口 | 3001 |
| 后端路径过滤 | `pathname.startsWith('/yjs')` (前缀匹配) |
| docName 提取 | 手动剥离 `/yjs/` 前缀 |
| 文本同步通道 | **只用 Yjs WS** |
| 光标/awareness | Yjs awareness (通过 WebSocket，跨设备) |

---

## 逐文件修改逻辑

### 文件 1: `client/src/services/yjsProvider.ts` — 客户端连接

```typescript
// WS_URL 策略：
// 开发模式: ws://localhost:5173/yjs → Vite 代理到 ws://localhost:3001/yjs
// 生产模式: ws://<当前host>/yjs → 后端 serve 静态文件 + WS 同端口
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = `${wsProtocol}//${window.location.host}/yjs`
// 开发模式: ws://localhost:5173/yjs
// 生产模式: ws://yourdomain.com/yjs

export function createYjs(docId: string, customUser?: Partial<UserAwareness>): CollabSession {
  const ydoc = new Y.Doc()
  const persistence = new IndexeddbPersistence(docId, ydoc)
  const provider = new WebsocketProvider(WS_URL, docId, ydoc)

  // ... user 设置 ...

  return { doc: ydoc, provider, persistence, user, roomName: docId, destroy }
}
```

关键点：
- **不用 `import.meta.env.DEV` 分支**——开发和生产都用 `window.location.host`，开发模式下通过 Vite 代理，生产模式下直连后端
- **`/yjs` 路径前缀**——WebsocketProvider 内部会拼接 `WS_URL + '/' + docId`，最终 URL = `ws://localhost:5173/yjs/<docId>`
- **不再直连后端端口**——所有请求都走当前页面 host，由 Vite 代理转发

### 文件 2: `client/vite.config.ts` — Vite 代理

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

关键点：
- 代理规则匹配 `/yjs` 前缀——所有以 `/yjs` 开头的 HTTP/WebSocket 请求都被代理
- `ws: true`——启用 WebSocket 代理
- `changeOrigin: true`——修改 Host header 为目标地址
- **不需要 rewrite**——后端也期望 `/yjs/<docName>` 路径格式

### 文件 3: `server/src/server.ts` — 后端 WebSocket 处理

```typescript
import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import { WebSocketServer } from 'ws'

const { setupWSConnection } = require('y-websocket/bin/utils')

const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] }))

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

const server = http.createServer(app)

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true })

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://x').pathname
  // 前缀匹配 /yjs——处理 ws://host/yjs/<docName> 格式
  if (pathname.startsWith('/yjs')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }
  // 其他 upgrade 请求忽略（不 destroy，让其他中间件处理）
})

wss.on('connection', (ws, req) => {
  // 从 URL 提取 docName
  // req.url = '/yjs/<docName>?<query>'
  // 剥离前导 '/' 和 'yjs/' 前缀
  const url = req.url || '/'
  const pathname = url.split('?')[0]              // '/yjs/<docName>'
  const docName = pathname.replace(/^\/yjs\//, '') || 'default'
  // docName = '<docName>'

  console.log(`[ws] Connection to document: ${docName}`)
  setupWSConnection(ws, req, { docName, gc: true })
})

server.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
  console.log(`[server] Accepting connections from: ${CLIENT_ORIGIN}`)
  console.log(`[server] Yjs WebSocket on path: /yjs/<docName>`)
})
```

关键变更说明：

**迁移前（有 bug）**:
```javascript
// 精确匹配——pathname 是 '/yjs/<docId>' 不等于 '/yjs' → 失败
if (pathname === '/yjs') { ... }

// setupWSConnection 默认 docName = req.url.slice(1).split('?')[0]
// req.url = '/yjs/<docId>' → docName = 'yjs/<docId>' → 错误！
wss.on('connection', setupWSConnection)  // 直接传递，不提取 docName
```

**迁移后（目标，修复）**:
```typescript
// 前缀匹配——'/yjs/<docId>' startsWith '/yjs' → true → 处理
if (pathname.startsWith('/yjs')) { ... }

// 手动提取 docName，剥离 /yjs/ 前缀
const docName = pathname.replace(/^\/yjs\//, '') || 'default'
// '/yjs/my-doc' → 'my-doc'  ✓
// '/yjs/' → '' → 'default'  ✓

// 显式传递 docName 给 setupWSConnection
setupWSConnection(ws, req, { docName, gc: true })
```

### 文件 4: `client/src/components/Editor.tsx` — 编辑器中的协作逻辑

编辑器组件中的协作相关逻辑变更：

#### 4.1 创建 Yjs 会话

**原代码 (Editor.jsx)**:
```javascript
const { ydoc, provider, persistence } = createYjs(docId);
// 然后:
const ytext = ydoc.getText("quill");
new QuillBinding(ytext, quill, awareness);
```

**新代码 (Editor.tsx)**:
```typescript
const session = createYjs(docId)
// TipTap 不需要手动绑定 Y.Text
// Collaboration 扩展自动绑定到 Y.Doc 的默认 XML fragment
// QuillBinding → Collaboration.configure({ document: session.doc })
```

关键区别：
- Quill 需要手动获取 `ydoc.getText("quill")` 并用 `QuillBinding` 绑定
- TipTap 的 `Collaboration` 扩展直接绑定到 `session.doc`，自动使用 Y.Doc 的默认 XML fragment（`ydoc.getXmlFragment('prosemirror')`），不需要手动指定

#### 4.2 Awareness — 光标和用户列表

**原代码 (Editor.jsx)**:
```javascript
// 手动创建 cursor
const cursors = quill.getModule("cursors");
cursors.createCursor(String(clientId), state.user.name, state.user.color);
cursors.moveCursor(String(clientId), state.selection);

// 手动删除离开的 cursor
removed.forEach((clientId) => {
  try { cursors.removeCursor(clientId); } catch {}
});

// 手动过滤自己
if (clientId === awareness.clientID) return;
```

**新代码 (Editor.tsx)**:
```typescript
// CollaborationCursor 扩展自动处理所有光标渲染
// 只需要监听 awareness 变化来更新协作者列表（头像）
useEffect(() => {
  if (!session) return
  const awareness = session.provider.awareness

  const handleChange = () => {
    const states = Array.from(awareness.getStates().entries())
    const list: RemoteUserState[] = []

    states.forEach(([clientId, state]) => {
      if (!state.user) return
      if (clientId === awareness.clientID) return  // 过滤自己
      list.push(state as RemoteUserState)
    })

    setUsers(list)
  }

  awareness.on('change', handleChange)
  return () => awareness.off('change', handleChange)
}, [session])
```

关键区别：
- **不再手动管理 cursor**——`CollaborationCursor` 扩展自动监听 awareness，自动创建/移动/删除远程光标
- 只需要监听 awareness 来更新**协作者头像列表**（UI 显示用）
- 光标的 DOM 渲染由 TipTap 扩展自动完成

#### 4.3 Awareness — selection 广播

**原代码 (Editor.jsx)**:
```javascript
quill.on("selection-change", (range) => {
  awareness.setLocalStateField("selection", range);
});
```

**新代码 (Editor.tsx)**:
```typescript
useEffect(() => {
  if (!editor || !session) return

  const handleSelectionUpdate = ({ editor }: { editor: Editor }) => {
    const { from, to } = editor.state.selection
    session.provider.awareness.setLocalStateField('selection', { from, to })
  }

  editor.on('selectionUpdate', handleSelectionUpdate)
  return () => editor.off('selectionUpdate', handleSelectionUpdate)
}, [editor, session])
```

关键区别：
- `quill.on('selection-change', ...)` → `editor.on('selectionUpdate', ...)`
- Quill 的 range 是 `{ index, length }`，TipTap 的 selection 是 `{ from, to }`
- `CollaborationCursor` 扩展读取 awareness 中的 `selection` 字段，期望 `{ from, to }` 格式

#### 4.4 Awareness — 标题同步

**原代码 (Editor.jsx)**:
```javascript
// 设置本地标题
awareness.setLocalStateField("docTitle", loadDocName(docId));

// 接收远程标题
if (state.docTitle && state.docTitle !== loadDocName(docId)) {
  titleFromRemoteRef.current = true;
  setTitle(state.docTitle);
  saveDocName(docId, state.docTitle);
}
```

**新代码 (Editor.tsx)**: 逻辑完全相同，只是添加 TypeScript 类型：
```typescript
// 设置本地标题
useEffect(() => {
  if (!session) return
  if (titleFromRemoteRef.current) {
    titleFromRemoteRef.current = false
    return
  }
  session.provider.awareness.setLocalStateField('docTitle', title)
}, [title, session])

// 接收远程标题（在 awareness change 监听器中）
if (state.docTitle && state.docTitle !== loadDocName(id || '')) {
  titleFromRemoteRef.current = true
  setTitle(state.docTitle)
  saveDocName(id || '', state.docTitle)
}
```

#### 4.5 连接状态监听

**原代码 (Editor.jsx)**:
```javascript
provider.on("status", (event) => {
  setConnected(event.status === "connected");
});
```

**新代码 (Editor.tsx)**: 完全相同：
```typescript
session.provider.on('status', (event: { status: string }) => {
  setConnected(event.status === 'connected')
})
```

#### 4.6 清理逻辑

**原代码 (Editor.jsx)**:
```javascript
cleanup = () => {
  if (countTimeout) clearTimeout(countTimeout);
  socket.disconnect();      // Socket.IO
  provider.disconnect();    // Yjs WebSocket
  ydoc.destroy();           // Y.Doc
};
```

**新代码 (Editor.tsx)**:
```typescript
// 在 useEffect 的 cleanup 中
useEffect(() => {
  if (!id) return
  const newSession = createYjs(id)

  // ... 设置监听 ...

  return () => {
    newSession.destroy()  // 一行搞定：provider.destroy() + persistence.destroy() + ydoc.destroy()
  }
}, [id])
```

关键区别：
- 移除 `socket.disconnect()`（不再有 Socket.IO）
- `newSession.destroy()` 封装了三个 destroy 调用

---

## y-websocket 版本选择

### 版本对比

| 版本 | client API | server `setupWSConnection` | `docName` 提取 |
|---|---|---|---|
| v1.5.0 (当前 server) | `new WebsocketProvider(url, room, doc)` | `req.url.slice(1).split('?')[0]` | 默认从 req.url 提取 |
| v2.0.4 | `new WebsocketProvider(url, room, doc)` | 同上 | 同上 |
| v3.0.0 (当前 client) | `new WebsocketProvider(url, room, doc)` | 同上 | 同上 |

三个版本的 `WebsocketProvider` 构造函数签名完全相同：`(serverUrl, roomname, doc, opts)`。

`setupWSConnection` 签名也相同：`(conn, req, { docName, gc })`。

**v1 → v2 → v3 的主要变化**：
- v2: 内部依赖更新（lib0, y-protocols），添加了 `params` URL 参数支持
- v3: 使用 `ObservableV2` 替代 `Observable`，API 兼容

**选择: 统一使用 v2.0.4**

理由：
- v2 与 TipTap 生态兼容性已验证
- v3 的 `ObservableV2` 变化可能导致与某些扩展的不兼容
- 前后端统一版本，避免协议差异

### 版本一致性要求

**关键**: 前端和后端的 y-websocket **必须同一版本**。

原因：y-websocket 的同步协议（sync protocol）在不同版本间可能有 binary 编码差异。虽然 v1/v2/v3 都使用 y-protocols 的 sync 协议，但 lib0 的 encoding/decoding 版本必须匹配。

```json
// server/package.json
"y-websocket": "^2.0.4"

// client/package.json
"y-websocket": "^2.0.4"
```

---

## 验证方案

### 验证 1: WebSocket 连接是否建立

启动后端和前端后，在浏览器 DevTools 的 Network 面板中：
1. 打开 `ws://localhost:5173/yjs/<docId>` 的连接
2. 确认状态为 101 Switching Protocols
3. 确认有 binary frames 双向传输

### 验证 2: CRDT 同步跨设备工作

关键测试——打开两个**不同浏览器**（如 Chrome + Edge）访问同一文档：
1. Chrome 中输入文字
2. Edge 中应实时看到文字出现
3. Edge 中输入文字
4. Chrome 中应实时看到

如果这个测试通过，说明 Yjs WebSocket 真正在工作（不是靠 BroadcastChannel）。

**注意**：同一浏览器的不同标签之间可以用 BroadcastChannel 同步，不需要 WebSocket。所以必须用不同浏览器测试才能验证 WebSocket。

### 验证 3: 光标和用户列表跨设备

1. Chrome 中用户名为 "User-1234"，光标在第一行
2. Edge 中应看到 "User-1234" 的光标和头像
3. 反之亦然

### 验证 4: 断线重连

1. 停止后端服务
2. 前端显示 "Offline"
3. 重启后端
4. 前端应自动重连并显示 "Connected"
5. 之前的编辑内容不丢失（IndexedDB 缓存）

---

## 完整连接链路图

```
┌─────────────────────────────────────────────────────────┐
│ 浏览器 (Chrome)                                          │
│                                                          │
│  Editor.tsx                                              │
│    ├── createYjs(docId)                                  │
│    │     └── new WebsocketProvider(                      │
│    │           'ws://localhost:5173/yjs',                │
│    │           docId,                                    │
│    │           ydoc                                      │
│    │         )                                           │
│    │       → 内部 URL: ws://localhost:5173/yjs/<docId>   │
│    │                                                     │
│    ├── useEditor({                                       │
│    │     extensions: [                                   │
│    │       Collaboration.configure({                     │
│    │         document: session.doc  ←── Y.Doc 绑定       │
│    │       }),                                           │
│    │       CollaborationCursor.configure({               │
│    │         provider: session.provider ←── awareness    │
│    │         user: { name, color }                      │
│    │       }),                                           │
│    │     ]                                               │
│    │   })                                                │
│    │                                                     │
│    └── awareness 监听                                    │
│          ├── 'change' → 更新协作者头像列表                │
│          ├── selectionUpdate → 广播选区                  │
│          └── docTitle → 标题同步                         │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket 升级请求
                       │ GET /yjs/<docId> HTTP/1.1
                       │ Host: localhost:5173
                       │ Upgrade: websocket
                       ↓
┌─────────────────────────────────────────────────────────┐
│ Vite Dev Server (端口 5173)                              │
│                                                          │
│  vite.config.ts:                                         │
│    proxy: {                                              │
│      '/yjs': {                                           │
│        target: 'ws://localhost:3001',                    │
│        ws: true,                                         │
│        changeOrigin: true                                │
│      }                                                   │
│    }                                                     │
│                                                          │
│  匹配 /yjs 前缀 → 代理到 ws://localhost:3001             │
│  转发: GET /yjs/<docId> Host: localhost:3001             │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket 升级请求（转发）
                       │ GET /yjs/<docId>
                       ↓
┌─────────────────────────────────────────────────────────┐
│ 后端 Express + Yjs WebSocket (端口 3001)                 │
│                                                          │
│  server.on('upgrade', (request, socket, head) => {       │
│    const pathname = '/yjs/<docId>'                       │
│    pathname.startsWith('/yjs') → true                    │
│    wss.handleUpgrade(request, socket, head, callback)    │
│  })                                                      │
│                                                          │
│  wss.on('connection', (ws, req) => {                     │
│    // req.url = '/yjs/<docId>'                           │
│    const docName = pathname.replace(/^\/yjs\//, '')      │
│    // docName = '<docId>'                                │
│    setupWSConnection(ws, req, { docName, gc: true })     │
│  })                                                      │
│                                                          │
│  setupWSConnection:                                      │
│    1. getYDoc(docName) → 创建或获取 Y.Doc                │
│    2. doc.conns.set(ws, new Set()) → 注册连接            │
│    3. ws.on('message', messageListener) → 监听消息       │
│    4. 发送 sync step1 → 客户端回复 sync step2 → 同步完成  │
│    5. awareness 广播 → 所有连接收到用户状态               │
│                                                          │
│  当任一客户端编辑:                                        │
│    client → ws.send(crdtUpdate) → server                 │
│    server → 广播给同 docName 的其他所有连接               │
│    other client → Y.applyUpdate → TipTap 更新 DOM        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 错误排查清单

如果迁移后协作不工作，按此顺序排查：

### 1. 检查 WebSocket 是否连接成功

浏览器 DevTools → Network → WS → 看是否有 `/yjs/<docId>` 的连接
- 没有 → 客户端 URL 或 Vite 代理配置有问题
- 有但状态不是 101 → 后端拒绝连接
- 有且 101 → 连接成功，继续排查

### 2. 检查 Vite 代理是否工作

浏览器控制台执行：
```javascript
// 检查 Vite 是否代理了 /yjs 路径
// 如果 Vite 代理失败，会返回 404 或 HTML
fetch('http://localhost:5173/yjs/test').then(r => r.status)
// 期望: 200 或 400（WebSocket 升级请求被拒绝，但路径匹配了）
// 不期望: 404（路径不匹配）
```

### 3. 检查后端是否收到连接

后端控制台应输出：
```
[ws] Connection to document: <docId>
```

如果没有，说明 Vite 代理没有转发到后端。

### 4. 检查 docName 提取是否正确

在后端 `wss.on('connection')` 中添加日志：
```typescript
console.log('[ws] req.url:', req.url)
console.log('[ws] pathname:', pathname)
console.log('[ws] docName:', docName)
```

期望输出：
```
[ws] req.url: /yjs/my-doc-123
[ws] pathname: /yjs/my-doc-123
[ws] docName: my-doc-123
```

如果 docName 是 `yjs/my-doc-123` 或 `undefined`，说明路径剥离逻辑有误。

### 5. 检查两个客户端是否在同一个 docName

两个浏览器打开同一个文档 URL（`http://localhost:5173/my-doc-123`），后端应输出两次：
```
[ws] Connection to document: my-doc-123
[ws] Connection to document: my-doc-123
```

如果 docName 不同，说明客户端传的 docId 不一致。

### 6. 检查 CRDT 同步消息

在 y-websocket 的 messageListener 中添加日志（需要修改 node_modules 中的源码，仅调试用）：
```javascript
conn.on('message', (message) => {
  console.log('[ws] Message from', docName, 'bytes:', message.byteLength)
  messageListener(conn, doc, new Uint8Array(message))
})
```

期望看到双向消息（两个方向都有 binary frames）。

### 7. BroadcastChannel 干扰测试

y-websocket 默认启用 BroadcastChannel，同一浏览器的标签间可以通过 BC 同步而不走 WebSocket。为了确认 WebSocket 真正在工作：

```typescript
// 在 createYjs 中禁用 BroadcastChannel
const provider = new WebsocketProvider(WS_URL, docId, ydoc, {
  disableBc: true,  // 禁用 BroadcastChannel，强制走 WebSocket
})
```

如果禁用 BC 后同浏览器跨标签仍然同步，说明 WebSocket 确实在工作。
