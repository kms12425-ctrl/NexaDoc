# 阶段一：核心架构升级 — 详细文件级实施计划

## 执行顺序

```
┌─ 阶段 A：后端独立迁移 ──────────────────────────────────────
│  Step 1: 服务端 TypeScript 化（新建 tsconfig, server.ts, 改 package.json）
│    ✅ 验证点 V1: 后端独立运行——npm install + npx tsc --noEmit + npm run dev
│    → 后端 /health 返回 200，Yjs WebSocket upgrade 正常
│    → 此时前端仍是旧代码，Socket.IO 会连接失败（预期行为）
│
├─ 阶段 B：前端整体迁移（Step 2-8 一口气做完）─────────────
│  Step 2: 客户端基础设施（package.json, tsconfig, vite.config）
│  Step 3: 客户端类型定义 + 工具函数迁移
│  Step 4: 客户端服务层迁移（yjsProvider, storage）
│  Step 5: 客户端编辑器组件（EditorToolbar + Editor 重写）
│  Step 6: 客户端其他组件迁移（DocsPage, App, main）
│  Step 7: CSS 适配（Quill → TipTap）
│  Step 8: 删除旧 .jsx/.js 文件
│    ✅ 验证点 V2: 编译验证——cd client && npm install && npx tsc --noEmit
│    → TypeScript 编译零错误，所有类型正确
│    ✅ 验证点 V3: 运行验证——npm run dev + 打开 http://localhost:5173
│    → 按 9.4 功能验证清单逐项检查
│
└─ 阶段 A/B 之间和 B 内部的验证策略 ─────────────────────
   • Step 1 之后：后端可独立验证（V1），前端不动
   • Step 2-7：每完成一个 Step 可运行 `npx tsc --noEmit` 做类型检查（T 检查）
     - T2: Step 2 后（检查 tsconfig 配置无误）
     - T3: Step 3 后（检查类型定义）
     - T4: Step 4 后（检查 yjsProvider + storage）
     - T5: Step 5 后（检查 Editor + EditorToolbar）
     - T6: Step 6 后（检查 DocsPage + App + main）
     - T7: Step 7 后（CSS 不影响 tsc，跳过）
   • Step 8 之后：完整验证（V2 编译 + V3 运行）
   • ⚠️ Step 2-7 期间前端网页不可运行——旧 package.json 卸载了 Quill/Socket.IO
     但新 .tsx 还在 import TipTap，npm install 前 Vite 会报错。这是"大爆炸"迁
     移的固有代价，用 tsc --noEmit 在每步后做类型检查来提前发现问题。
```

---

## 架构预留设计

阶段一在类型定义和服务端骨架中**预留衔接点**，为后续阶段的持久化、用户系统、权限系统做准备。本阶段不实现这些功能，但类型层面提前就绪。

1. **能力契约模式**：后端在文档序列化时返回 `abilities` 布尔值（`can_edit`, `can_delete`, `can_share`, `can_comment`, `can_view_version_history` 等），前端直接消费决定 UI 显示/隐藏。权限逻辑集中在后端，前端只做展示。阶段一在 `types/index.ts` 中预留 `DocumentAbilities` 接口骨架，所有能力默认 `true`（单用户无权限控制）。

2. **文档内容与元数据分离**：二进制 CRDT state 可能很大（MB 级），应与元数据分离存储。阶段一在 `DocumentMeta` 类型中预留 `parentId`（文档树）和 `deletedAt`（软删除）字段，后续接入 MongoDB 时 `documents` 集合存元数据，`crdtState` 可独立存储。

3. **协作连接生命周期管理**：阶段一继续用裸 y-websocket（无认证无权限），但在 `server.ts` 的 upgrade 处理处预留注释钩子，标注未来在此处插入 token 验证和权限检查。

4. **软删除 + 文档树结构**：`DocumentMeta` 类型预留 `deletedAt` 和 `parentId` 字段，阶段一不实现相关功能，后续阶段接入 MongoDB 时直接启用。

### 后续阶段路线图

| 阶段 | 目标 |
|---|---|
| 阶段一（本计划） | TS + TipTap + 纯 Yjs WebSocket |
| 阶段二 | MongoDB 持久化 + 版本历史 |
| 阶段三 | 用户注册登录 + 文档归属 |
| 阶段四 | RBAC 权限系统 + 分享邀请 |
| 阶段五 | 评论系统 |
| 阶段六 | 文档树 + 软删除回收站 + 收藏夹 |

---

## Step 1: 服务端 TypeScript 化

### 1.1 新建 `server/tsconfig.json`

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

关键点：
- `module: "CommonJS"` — 因为 `y-websocket/bin/utils` 是 CommonJS，`require()` 方式引入
- `esModuleInterop: true` — 允许 `import express from 'express'` 语法
- `strict: true` — 全量类型检查
- `outDir: "./dist"` — 编译输出到 dist/，`npm start` 运行编译后代码

### 1.2 修改 `server/package.json`

**当前内容**:
```json
{
  "name": "server",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "type": "commonjs",
  "dependencies": {
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "socket.io": "^4.8.3",
    "ws": "^8.20.0",
    "y-websocket": "^1.5.0",
    "yjs": "^13.6.30"
  }
}
```

**修改后**:
```json
{
  "name": "server",
  "version": "1.0.0",
  "main": "dist/server.js",
  "scripts": {
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "type": "commonjs",
  "dependencies": {
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "ws": "^8.20.0",
    "y-websocket": "^2.0.4",
    "yjs": "^13.6.30"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "@types/ws": "^8.5.13",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.2"
  }
}
```

变更说明：
- **移除 `socket.io`** — 不再需要双通道
- **`y-websocket` 升级到 `^2.0.4`** — TipTap 生态兼容
- **新增 devDependencies** — TypeScript 工具链 + 类型声明
- **scripts 变更** — `dev` 用 ts-node 直接运行 TS，`build` 用 tsc 编译，`start` 运行编译后代码
- **`main` 指向 `dist/server.js`**

注意 Express 5 的类型声明：Express 5 对应 `@types/express@^5.0.0`（当前还是 beta，但可用）。如果安装时遇到问题，回退到 `@types/express@^4.17.21` 并降级 express 到 `^4.21.2`。

### 1.3 新建 `server/src/server.ts`（重写自 `server/index.js`）

逐段对照原 `index.js` 的改写逻辑：

#### 1.3.1 导入部分

```typescript
// 原 index.js（CommonJS require）:
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");    // ← 移除
const cors = require("cors");
const WebSocket = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");

// 新 server.ts（ES import + types）:
import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import { WebSocketServer } from 'ws'
// y-websocket 的 utils 是 CommonJS，需要 require 兼容写法
const { setupWSConnection } = require('y-websocket/bin/utils')
```

关键点：
- `socket.io` 导入**完全移除**
- `WebSocket` 导入改为只导入 `WebSocketServer`（不再需要 `WebSocket` 类型本身）
- `setupWSConnection` 保持 `require` 写法——`y-websocket/bin/utils` 没有类型声明，用 `require` 避免 TS 报错

#### 1.3.2 配置 + Express 应用

```typescript
const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const app = express()

app.use(cors({ origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] }))

// Health check（移除 documents 计数，阶段一没有持久化）
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})
```

变更：
- `documents: Object.keys(documents).length` 从 health 响应中**移除**（不再有内存文档存储）
- 添加 `_req: Request, res: Response` 类型注解

#### 1.3.3 HTTP 服务器 + WebSocket

```typescript
const server = http.createServer(app)

// Yjs WebSocket server — noServer 模式，共享 HTTP 端口
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true })

wss.on('connection', (ws, req) => {
  // 从 URL path 提取 docName（y-websocket v2 的 room 路由方式）
  // y-websocket 客户端连接 URL 格式: ws://host:port/yjs/<docName>
  setupWSConnection(ws, req)
})

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://x').pathname
  if (pathname.startsWith('/yjs')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }
  // 不再需要处理 /socket.io 路径——已移除
})
```

关键变更：
- `pathname === '/yjs'` 改为 `pathname.startsWith('/yjs')` — 因为 y-websocket v2 客户端连接时 URL 是 `ws://host:port/yjs/<docName>`，path 包含文档名
- `wss.on('connection', setupWSConnection)` 改为带参数的箭头函数，显式传递 `ws` 和 `req`
- **移除所有 Socket.IO 代码**：
  - `new Server(server, { cors: ... })` — 删除
  - `io.on('connection', ...)` — 整个事件处理块（join-document, send-changes, save-document, disconnect）全部删除
  - Socket.IO 的 CORS 配置 — 删除

> **架构预留 — 协作连接生命周期管理**：
>
> 阶段一无认证无权限，但 upgrade handler 是未来插入认证的衔接点：
>
> ```typescript
> // ── 阶段三/四预留：在此处插入认证钩子 ──
> server.on('upgrade', (request, socket, head) => {
>   const pathname = new URL(request.url, 'http://x').pathname
>   if (pathname.startsWith('/yjs')) {
>     // TODO(阶段三): 从 request.headers 提取 token，验证用户身份
>     // TODO(阶段四): 从 URL 提取 docName，查询用户对该文档的权限
>     //               如果无权限 → socket.destroy() 拒绝连接
>     //               如果有权限 → wss.handleUpgrade(...)
>     wss.handleUpgrade(request, socket, head, (ws) => {
>       wss.emit('connection', ws, request)
>     })
>   }
> })
> ```
>
> 此外，阶段四实现权限系统时，可以在服务端维护一个 `docId → Set<ws>` 映射，权限变更时关闭对应文档的所有 WebSocket 连接，客户端 WebsocketProvider 会自动重连并重新走认证流程。阶段一不需要实现这个机制，但提前了解这个模式有助于后续架构决策。

#### 1.3.4 移除内存文档存储

**整段删除**:
```javascript
// 原 index.js — 全部删除
const documents = {};
const documentOrder = [];
const CHUNK_SIZE = 64 * 1024;
function storeDocument(docId, content) { ... }
```

阶段一不实现持久化（重启丢失），与原项目行为一致。阶段二用 MongoDB 替代。

#### 1.3.5 启动 + 优雅关闭

```typescript
server.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
  console.log(`[server] Accepting connections from: ${CLIENT_ORIGIN}`)
})

function shutdown(signal: string) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully…`)
  server.close(() => {
    console.log('[server] HTTP server closed.')
    process.exit(0)
  })
  setTimeout(() => {
    console.error('[server] Forced exit after timeout.')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

唯一变更：`signal` 参数添加 `string` 类型注解。

#### 1.3.6 完整的 server.ts 文件结构

```typescript
import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import { WebSocketServer } from 'ws'

// y-websocket/bin/utils 没有 TypeScript 类型声明，用 require 避免 TS 报错
// eslint-disable-next-line @typescript-eslint/no-var-requires
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

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://x').pathname
  if (pathname.startsWith('/yjs')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }
})

server.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
  console.log(`[server] Accepting connections from: ${CLIENT_ORIGIN}`)
})

function shutdown(signal: string) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully…`)
  server.close(() => {
    console.log('[server] HTTP server closed.')
    process.exit(0)
  })
  setTimeout(() => {
    console.error('[server] Forced exit after timeout.')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

### 1.4 删除 `server/index.js`

在 `server/src/server.ts` 验证可运行后删除原文件。

### ✅ 验证点 V1：后端独立验证

完成 Step 1 后，后端可以独立运行和验证：

```bash
cd server
npm install              # 安装 TS 工具链 + 新依赖
npx tsc --noEmit       # 类型检查（应零错误）
npm run dev             # 启动：ts-node src/server.ts → http://localhost:3001
```

验证清单：
- [ ] `npx tsc --noEmit` 零错误
- [ ] `npm run dev` 后控制台输出 `[server] Running on http://localhost:3001`
- [ ] 浏览器访问 `http://localhost:3001/health` 返回 `{"status":"ok",...}`
- [ ]（可选）用 wscat 测试 WebSocket：`npx wscat -c ws://localhost:3001/yjs/test`，连接成功即说明 upgrade 路径正确

> ⚠️ 此时前端仍是旧代码（Editor.jsx 仍用 Socket.IO），打开 http://localhost:5173 会有 Socket.IO 连接错误，**这是预期行为**——后端已移除 Socket.IO。不需要在此阶段验证前端。

---

## Step 2: 客户端基础设施

### 2.1 修改 `client/package.json`

**当前依赖**:
```json
{
  "dependencies": {
    "docx": "^9.6.1",
    "file-saver": "^2.0.5",
    "html2pdf.js": "^0.14.0",
    "lucide-react": "^1.7.0",
    "quill": "^2.0.3",              // ← 移除
    "quill-cursors": "^4.2.0",      // ← 移除
    "react": "^19.2.4",             // ← 降级到 18.3
    "react-dom": "^19.2.4",         // ← 降级到 18.3
    "react-router-dom": "^7.13.2",  // ← 检查 React 18 兼容性
    "socket.io-client": "^4.8.3",   // ← 移除
    "y-indexeddb": "^9.0.12",
    "y-quill": "^1.0.0",            // ← 移除
    "y-websocket": "^3.0.0",        // ← 降级到 ^2.0.4 与服务端统一
    "yjs": "^13.6.30"
  }
}
```

**修改后**:
```json
{
  "dependencies": {
    "@tiptap/extension-collaboration": "^2.11.5",
    "@tiptap/extension-collaboration-cursor": "^2.11.5",
    "@tiptap/extension-color": "^2.11.5",
    "@tiptap/extension-font-family": "^2.11.5",
    "@tiptap/extension-highlight": "^2.11.5",
    "@tiptap/extension-placeholder": "^2.11.5",
    "@tiptap/extension-text-align": "^2.11.5",
    "@tiptap/extension-text-style": "^2.11.5",
    "@tiptap/extension-underline": "^2.11.5",
    "@tiptap/pm": "^2.11.5",
    "@tiptap/react": "^2.11.5",
    "@tiptap/starter-kit": "^2.11.5",
    "docx": "^9.6.1",
    "file-saver": "^2.0.5",
    "html2pdf.js": "^0.14.0",
    "lucide-react": "^0.475.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "y-indexeddb": "^9.0.12",
    "y-websocket": "^2.0.4",
    "yjs": "^13.6.30"
  },
  "devDependencies": {
    "@types/file-saver": "^2.0.7",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@types/node": "^22.10.2",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.0.7"
  }
}
```

变更明细：
- **移除**: `quill`, `quill-cursors`, `y-quill`, `socket.io-client`
- **新增 TipTap**: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, 7 个扩展
- **新增 `@tiptap/extension-font-family`** — 字体选择扩展
- **降级 React**: `^19.2.4` → `^18.3.1`（react + react-dom）
- **降级 react-router-dom**: `^7.13.2` → `^6.28.0`（React 18 兼容）
- **降级 y-websocket**: `^3.0.0` → `^2.0.4`（与服务端统一）
- **降级 lucide-react**: `^1.7.0` → `^0.475.0`（v1.x 的 lucide-react 包名结构不同）
- **降级 Vite**: 保留 `^6.0.7`（已在上次验证中确认可用）
- **新增 devDependencies**: TypeScript 工具链 + 类型声明
- **新增 `@types/file-saver`** — file-saver 没有自带类型声明
- **scripts 变更**: `"build": "tsc && vite build"`

注意：`@vitejs/plugin-react` 也要从 v6 降级到 v4（v6 要求 Node 20.19+，v4 兼容 Node 20.18）。

### 2.2 新建 `client/tsconfig.json`

```json
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
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src"]
}
```

关键点：
- `jsx: "react-jsx"` — 使用 React 18 的自动 JSX 转换，不需要 `import React from 'react'`
- `noEmit: true` — Vite 负责编译输出，tsc 只做类型检查
- `moduleResolution: "bundler"` — Vite 的模块解析方式
- `allowImportingTsExtensions: true` — 允许 `import './App.tsx'`（Vite 需要）

### 2.3 新建 `client/tsconfig.node.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["vite.config.ts"]
}
```

### 2.4 修改 `client/vite.config.js` → `client/vite.config.ts`

**当前内容**:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**修改后**:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Yjs WebSocket 代理——客户端连接 ws://localhost:5173/yjs/<docId>
      // Vite 代理到后端 ws://localhost:3001
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
- 添加 `/yjs` 路径的 WebSocket 代理
- 客户端连接 `ws://localhost:5173/yjs/<docId>`，Vite 代理到后端 `ws://localhost:3001/yjs/<docId>`
- 这样客户端代码中不需要硬编码后端端口，开发体验更好
- 不再需要 Socket.IO 的 proxy 配置

### 2.5 修改 `client/index.html`

```html
<!-- 把 main.jsx 改为 main.tsx -->
<script type="module" src="/src/main.tsx"></script>
```

其他内容不变。

### 2.6 修改 `client/eslint.config.js`

**当前**: `files: ['**/*.{js,jsx}']`

**修改为**: `files: ['**/*.{ts,tsx}']`

同时需要安装 TypeScript ESLint 依赖（可选，阶段一可以先跳过 lint 配置，保证编译通过即可）。

### 🔍 类型检查点 T2：配置验证

完成 Step 2 后，可以验证 TS 配置是否正确（此时还没有 .ts 源码，只检查 tsconfig 语法）：

```bash
cd client
# 先不 npm install（因为 package.json 已改为 TipTap 依赖，安装后旧 .jsx 会报错）
# 只验证 tsconfig.json 语法是否正确
npx --yes typescript@5.7.2 tsc --noEmit -p tsconfig.json 2>&1 | head -5
# 预期：报 "No inputs were found" 或类似——因为 src/ 下还没有 .ts 文件，这是正常的
# 如果报 "Cannot find module 'typescript'" 说明 tsconfig 解析有问题
```

> ⚠️ **不要在此阶段运行 `npm install`**——新 package.json 移除了 Quill/Socket.IO，但旧 .jsx 文件还在 import 它们。npm install 后 Vite 会启动失败。要等到 Step 8 删除旧文件后再 install。

---

## Step 3: 客户端类型定义 + 工具函数迁移

### 3.1 新建 `client/src/types/index.ts`

```typescript
import type * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'
import type { IndexeddbPersistence } from 'y-indexeddb'

// 用户 awareness 状态（用于 Yjs awareness 协议）
export interface UserAwareness {
  id: string
  name: string
  color: string
}

// 协作会话——封装 Yjs 三件套
export interface CollabSession {
  doc: Y.Doc
  provider: WebsocketProvider
  persistence: IndexeddbPersistence
  user: UserAwareness
  roomName: string
  destroy: () => void
}

// 文档元数据（localStorage 和后续 API 共用）
export interface DocumentMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  // ── 预留字段（为后续阶段准备）──
  parentId?: string | null         // 文档树结构：父文档 ID（阶段六启用）
  deletedAt?: number | null        // 软删除时间戳（阶段六启用）
  abilities?: DocumentAbilities    // 当前用户对该文档的能力契约（阶段四启用）
}

// 连接状态
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

// Awareness 中其他用户的状态
export interface RemoteUserState {
  user: UserAwareness
  selection?: { from: number; to: number } | null
  docTitle?: string
}

// ── 预留：文档能力契约（后端返回能力布尔值，前端消费）──
// 阶段四实现 RBAC 权限系统时，后端在文档序列化时返回这些布尔值，
// 前端 UI 直接消费决定按钮/操作的显示与隐藏。
// 阶段一所有能力默认 true（单用户无权限控制）。
export interface DocumentAbilities {
  canView?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canShare?: boolean
  canComment?: boolean
  canViewHistory?: boolean
  // 后续可扩展更多能力字段...
}
```

### 3.2 `client/src/utils/generateId.js` → `generateId.ts`

**当前**:
```javascript
export const generateId = (name) => {
  return name.replace(/\s+/g, "-") + "-" + Date.now();
};
```

**修改后**:
```typescript
export const generateId = (name: string): string => {
  return name.replace(/\s+/g, '-') + '-' + Date.now()
}
```

唯一变更：添加参数和返回值类型注解。

### 🔍 类型检查点 T3：类型定义验证

完成 Step 3 后，`types/index.ts` 和 `generateId.ts` 已创建。可以检查这两个文件的类型正确性：

```bash
cd client
# 用 npx 临时安装 typescript 检查（不修改 node_modules）
npx --yes typescript@5.7.2 tsc --noEmit --strict --moduleResolution bundler --jsx react-jsx \
  src/types/index.ts src/utils/generateId.ts 2>&1
# 预期：零错误。如果报 "Cannot find name" 说明有类型引用问题
# 注意：yjs/y-websocket/y-indexeddb 的类型在此阶段可能找不到（未 npm install），
#       可以加 --skipLibCheck 跳过库检查
```

> 此阶段网页仍不可运行。`types/index.ts` 是纯类型文件，不影响运行时；`generateId.ts` 逻辑简单，类型正确即可。

---

## Step 4: 客户端服务层迁移

### 4.1 `client/src/services/yjsProvider.js` → `yjsProvider.ts`

**当前内容**:
```javascript
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";

const YJS_URL = import.meta.env.VITE_YJS_URL || "ws://localhost:3001/yjs";

export const createYjs = (docId) => {
  const ydoc = new Y.Doc();
  const persistence = new IndexeddbPersistence(docId, ydoc);
  const provider = new WebsocketProvider(YJS_URL, docId, ydoc);
  return { ydoc, provider, persistence };
};
```

**修改后**:
```typescript
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CollabSession, UserAwareness } from '../types'

// 用户颜色调色板（从原 Editor.jsx 移出）
const USER_COLORS = [
  '#4285f4', '#ea4335', '#34a853', '#fbbc04',
  '#ff6d00', '#aa00ff', '#00acc1', '#e91e63',
]

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
}

function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substring(2, 9)
}

function generateUserName(): string {
  return 'User-' + Math.floor(Math.random() * 9000 + 1000)
}

// 开发环境通过 Vite 代理连接（ws://localhost:5173/yjs/<docId> → ws://localhost:3001/yjs/<docId>）
// 生产环境直连后端
const WS_URL = import.meta.env.VITE_YJS_URL || 'ws://localhost:5173/yjs'

export function createYjs(
  docId: string,
  customUser?: Partial<UserAwareness>
): CollabSession {
  const ydoc = new Y.Doc()

  const persistence = new IndexeddbPersistence(docId, ydoc)

  const provider = new WebsocketProvider(WS_URL, docId, ydoc)

  const user: UserAwareness = {
    id: customUser?.id || generateUserId(),
    name: customUser?.name || generateUserName(),
    color: customUser?.color || getRandomColor(),
  }

  // 设置 awareness——其他客户端通过 awareness 获取用户信息
  provider.awareness.setLocalStateField('user', {
    id: user.id,
    name: user.name,
    color: user.color,
  })

  const destroy = () => {
    provider.destroy()
    persistence.destroy()
    ydoc.destroy()
  }

  return {
    doc: ydoc,
    provider,
    persistence,
    user,
    roomName: docId,
    destroy,
  }
}
```

关键变更：
- **移除 Socket.IO 依赖** — 不再需要 `io(API_URL)` 和 `socket.emit('join-document')`
- **WS_URL 改为 `ws://localhost:5173/yjs`** — 通过 Vite 代理，不再直连 3001 端口
- **用户生成逻辑移入此处** — 原来在 Editor.jsx 中生成 `User-XXXX` 和随机颜色，现在统一在 createYjs 中
- **返回 CollabSession 类型** — 包含 `doc`, `provider`, `persistence`, `user`, `roomName`, `destroy()`
- **新增 `destroy()` 方法** — 统一清理资源，替代 Editor.jsx 中分散的 cleanup 逻辑
- **customUser 可选参数** — 后续用户认证实现后可以传入真实用户信息

> **架构预留**：awareness 中除了 `name`/`color` 还可携带 `user_id`，服务端在连接建立时可从 awareness 或连接参数中提取用户身份做权限校验。本项目的 `customUser` 参数就是为此预留——阶段三实现登录后，`createYjs(docId, { id: loggedInUser.id, name: loggedInUser.name, color: loggedInUser.avatarColor })` 即可无缝接入，awareness 协议和 CollabSession 接口不需要改动。

### 4.2 `client/src/services/storage.js` → `storage.ts`

**当前内容**:
```javascript
export const getDocs = () => {
  try {
    const docs = JSON.parse(localStorage.getItem("docs") || "[]");
    return docs.filter(d => d.id && d.name);
  } catch {
    return [];
  }
};

export const saveDocs = (docs) => {
  localStorage.setItem("docs", JSON.stringify(docs));
};
```

**修改后**:
```typescript
import type { DocumentMeta } from '../types'

export const getDocs = (): DocumentMeta[] => {
  try {
    const docs = JSON.parse(localStorage.getItem('docs') || '[]')
    return docs.filter((d: DocumentMeta) => d.id && d.name)
  } catch {
    return []
  }
}

export const saveDocs = (docs: DocumentMeta[]): void => {
  localStorage.setItem('docs', JSON.stringify(docs))
}
```

唯一变更：添加类型注解，过滤回调参数类型标注。逻辑完全不变。

### 🔍 类型检查点 T4：服务层验证

完成 Step 4 后，`yjsProvider.ts` 和 `storage.ts` 已创建。检查类型正确性：

```bash
cd client
npx --yes typescript@5.7.2 tsc --noEmit --strict --moduleResolution bundler --jsx react-jsx \
  --skipLibCheck \
  src/types/index.ts src/utils/generateId.ts \
  src/services/yjsProvider.ts src/services/storage.ts 2>&1
# 预期：零错误（--skipLibCheck 跳过 yjs/y-websocket 库的类型声明检查）
# 常见错误：
#   - "Cannot find module 'yjs'" → 正常，未 npm install，加 --skipLibCheck 可跳过
#   - "Property 'awareness' does not exist" → 检查 WebsocketProvider 类型导入
```

> ⚠️ 网页仍不可运行。`yjsProvider.ts` 依赖 yjs/y-websocket/y-indexeddb，这些包要等 Step 8 后 `npm install` 才真正可用。

---

## Step 5: 客户端编辑器组件（核心重写）

这是最大的改动，涉及两个新文件：`EditorToolbar.tsx` 和 `Editor.tsx`。

### 5.1 新建 `client/src/extensions/FontSize.ts`（自定义 TipTap 扩展）

TipTap 没有内置 font-size 扩展，需要自定义。基于 TextStyle 扩展添加 `fontSize` 属性：

```typescript
import { Extension } from '@tiptap/core'

// 自定义 FontSize 扩展——在 TextStyle 的基础上添加 fontSize 属性
// TipTap 的 TextStyle 扩展会自动处理 style 属性的合并
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: size }).run()
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
        },
    }
  },
})
```

关键点：
- `Extension.create()` — TipTap 2.x 创建扩展的方式
- `addGlobalAttributes()` — 给 textStyle mark 添加 `fontSize` 属性
- `parseHTML` — 从 DOM 的 `style.fontSize` 读取
- `renderHTML` — 生成 `style="font-size: 12pt"` 内联样式
- `declare module '@tiptap/core'` — 扩展 Commands 接口，让 `editor.commands.setFontSize()` 有类型提示

### 5.2 新建 `client/src/components/EditorToolbar.tsx`

从原 `Editor.jsx` 中提取工具栏 UI，改为 TipTap 命令调用方式。

**原 Editor.jsx 工具栏**（Quill 方式）：
```javascript
// Quill 通过 container 配置自动生成工具栏
modules: {
  toolbar: {
    container: [
      [{ font: FontClass.whitelist }],      // 字体下拉
      [{ size: SizeClass.whitelist }],      // 字号下拉
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],  // 颜色选择器
      [{ align: [] }],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      ["link"],
      ["clean"],
    ],
  },
  cursors: true,
}
```

**新 EditorToolbar.tsx**（TipTap 方式）：

```typescript
import { type Editor } from '@tiptap/react'
// ... 组件实现
```

组件职责和 UI 对照：

| 原功能（Quill） | 新功能（TipTap） | TipTap 命令 |
|---|---|---|
| 字体下拉（13 种） | 字体下拉（13 种） | `editor.chain().setMark('textStyle', { fontFamily: 'Arial' }).run()` |
| 字号下拉（15 档） | 字号下拉（15 档） | `editor.commands.setFontSize('12pt')` |
| 粗体 | 粗体 | `editor.chain().toggleBold().run()` |
| 斜体 | 斜体 | `editor.chain().toggleItalic().run()` |
| 下划线 | 下划线 | `editor.chain().toggleUnderline().run()` |
| 删除线 | 删除线 | `editor.chain().toggleStrike().run()` |
| 文字颜色 | 文字颜色 | `editor.chain().setColor('#ff0000').run()` |
| 背景色 | 高亮色 | `editor.chain().toggleHighlight({ color: '#ffff00' }).run()` |
| 对齐（4 种） | 对齐（4 种） | `editor.chain().setTextAlign('center').run()` |
| 有序列表 | 有序列表 | `editor.chain().toggleOrderedList().run()` |
| 无序列表 | 无序列表 | `editor.chain().toggleBulletList().run()` |
| 缩进减少 | 缩进减少 | `editor.chain().liftListItem('listItem').run()` |
| 缩进增加 | 缩进增加 | `editor.chain().sinkListItem('listItem').run()` |
| 链接 | 链接 | `editor.chain().setLink({ href: url }).run()` |
| 清除格式 | 清除格式 | `editor.chain().unsetAllMarks().clearNodes().run()` |

UI 实现要点：
- 字体/字号用原生 `<select>` 下拉（与原项目风格一致，不用 Quill 的 picker）
- 粗体/斜体等按钮用 SVG 图标（保持原项目的 SVG 风格）
- 颜色选择器用 `<input type="color">` + 触发按钮
- 对齐用 4 个按钮组
- **按钮 active 状态**：`editor.isActive('bold')` 等方法检测当前格式

字体列表常量（从原 Editor.jsx 移出）：
```typescript
const FONT_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Raleway, sans-serif', label: 'Raleway' },
  { value: 'Ubuntu, sans-serif', label: 'Ubuntu' },
  { value: '"Playfair Display", serif', label: 'Playfair Display' },
  { value: 'Merriweather, serif', label: 'Merriweather' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro' },
  { value: 'Nunito, sans-serif', label: 'Nunito' },
]

const FONT_SIZE_OPTIONS = [
  '8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt',
  '18pt', '20pt', '24pt', '28pt', '32pt', '36pt', '48pt', '72pt',
]
```

注意：Quill 用 CSS class（`.ql-font-arial`）来设置字体，TipTap 用 `fontFamily` mark 直接设置 `style="font-family: Arial"`。所以字体值从 Quill 的 class 名（`arial`）改为完整的 CSS font-family 值（`Arial, sans-serif`）。

### 5.3 新建 `client/src/components/Editor.tsx`（重写）

这是最复杂的文件。逐段说明改写逻辑：

#### 5.3.1 导入部分

```typescript
// 原 Editor.jsx 导入
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import QuillCursors from "quill-cursors";
import { QuillBinding } from "y-quill";
import { createYjs } from "../services/yjsProvider";
import html2pdf from "html2pdf.js";
import { saveAs } from "file-saver";
import { io } from "socket.io-client";

// 新 Editor.tsx 导入
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import FontFamily from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import { createYjs } from '../services/yjsProvider'
import html2pdf from 'html2pdf.js'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import type { CollabSession, UserAwareness, RemoteUserState } from '../types'
import { EditorToolbar } from './EditorToolbar'
import { FontSize } from '../extensions/FontSize'
```

变更：
- **移除**: `Quill`, `QuillCursors`, `QuillBinding`, `io`（socket.io-client）
- **移除**: `"quill/dist/quill.snow.css"`（Quill 样式）
- **新增**: TipTap 相关导入
- **新增**: `docx` 库导入（用于格式化 DOCX 导出）
- **新增**: `EditorToolbar` 组件导入
- **新增**: `FontSize` 自定义扩展导入

#### 5.3.2 Quill 注册代码——整段删除

```javascript
// 原 Editor.jsx — 全部删除
Quill.register("modules/cursors", QuillCursors);
const FontClass = Quill.import("attributors/class/font");
FontClass.whitelist = [...];
Quill.register(FontClass, true);
const SizeClass = Quill.import("attributors/class/size");
SizeClass.whitelist = [...];
Quill.register(SizeClass, true);
const USER_COLORS = [...];
function getRandomColor() { ... }
function countWords(text) { ... }
function loadDocName(docId) { ... }
function saveDocName(docId, name) { ... }
```

这些函数的处理：
- `Quill.register(...)` — **删除**，TipTap 不需要
- `USER_COLORS` + `getRandomColor()` — **移到 yjsProvider.ts**（已在 Step 4.1 处理）
- `countWords(text)` — **保留在 Editor.tsx 中**，添加类型注解
- `loadDocName(docId)` + `saveDocName(docId, name)` — **保留在 Editor.tsx 中**，添加类型注解

#### 5.3.3 组件状态

```typescript
export default function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // 标题状态——初始化从 localStorage 读取
  const [title, setTitle] = useState(() => loadDocName(id || ''))
  const [users, setUsers] = useState<RemoteUserState[]>([])
  const [activeUser, setActiveUser] = useState<string>('')
  const [mode, setMode] = useState<'edit' | 'view'>('edit')
  const [connected, setConnected] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)

  // 协作会话引用
  const sessionRef = useRef<CollabSession | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const titleFromRemoteRef = useRef(false)
```

变更：
- `useParams<{ id: string }>()` — 添加泛型类型
- `mode` 类型从 `string` 改为 `'edit' | 'view'`
- `users` 类型从 `any[]` 改为 `RemoteUserState[]`
- **移除**: `wrapperRef`（Quill 需要手动挂载 DOM 容器，TipTap 用 `<EditorContent>` 组件）
- **移除**: `quillRef`（改用 `editorRef` 存储 TipTap editor 实例）
- **移除**: `loadProgress` 状态（不再有分块传输）
- **新增**: `sessionRef` — 存储 CollabSession 引用，用于清理
- **新增**: `editorRef` — 存储 TipTap editor 实例

#### 5.3.4 TipTap 编辑器创建

这是核心改动。原项目在 `useEffect` 中命令式创建 Quill 实例，TipTap 用 `useEditor` hook 声明式创建：

```typescript
// 创建 Yjs 协作会话（在 useEditor 之前，因为 editor 依赖 session.doc）
const [session, setSession] = useState<CollabSession | null>(null)

useEffect(() => {
  if (!id) return
  const newSession = createYjs(id)
  setSession(newSession)

  // 连接状态监听
  newSession.provider.on('status', (event: { status: string }) => {
    setConnected(event.status === 'connected')
  })

  return () => {
    newSession.destroy()
    setSession(null)
  }
}, [id])

// TipTap 编辑器
const editor = useEditor({
  extensions: [
    // StarterKit 包含: bold, italic, strike, code, heading, bulletList,
    // orderedList, blockquote, codeBlock, hardBreak, horizontalRule, etc.
    // 关闭 history——由 Collaboration 扩展提供 undo/redo
    StarterKit.configure({
      history: false,
    }),

    // Yjs CRDT 协作——绑定 TipTap 到 Y.Doc
    Collaboration.configure({
      document: session?.doc,
    }),

    // 远程光标——显示其他协作者的选区和用户名
    CollaborationCursor.configure({
      provider: session?.provider,
      user: session
        ? {
            name: session.user.name,
            color: session.user.color,
          }
        : undefined,
    }),

    // 字体
    FontFamily,

    // 字号（自定义扩展）
    FontSize,

    // 下划线（StarterKit 不含下划线）
    Underline,

    // 文本对齐
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),

    // 文字颜色
    TextStyle,
    Color,

    // 高亮
    Highlight.configure({
      multicolor: true,
    }),

    // 占位符
    Placeholder.configure({
      placeholder: 'Start typing your document…',
    }),
  ],

  onUpdate: ({ editor }) => {
    const text = editor.getText()
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
    setCharCount(Math.max(0, text.length - 1))
  },
}, [session?.doc, session?.provider])
```

关键变更对照：

| 原（Quill） | 新（TipTap） |
|---|---|
| `useEffect` 中 `new Quill(container, {...})` | `useEditor({ extensions: [...] })` |
| `QuillBinding(ytext, quill, awareness)` | `Collaboration.configure({ document: session.doc })` |
| `quill.getModule('cursors')` + 手动 `createCursor` | `CollaborationCursor.configure({ provider, user })` 自动处理 |
| `StarterKit.configure({ history: false })` | 关闭内置 history，由 Yjs CRDT 提供 undo/redo |
| `quill.on('text-change', ...)` 计算字数 | `onUpdate: ({ editor }) => { ... }` 回调 |

#### 5.3.5 Awareness 监听（协作者列表 + 标题同步）

```typescript
// 监听 awareness 变化——更新协作者列表和标题同步
useEffect(() => {
  if (!session) return

  const awareness = session.provider.awareness

  const handleAwarenessChange = () => {
    const states = Array.from(awareness.getStates().entries())
    const list: RemoteUserState[] = []
    let typing = ''

    states.forEach(([clientId, state]) => {
      if (!state.user) return
      // 不显示自己
      if (clientId === awareness.clientID) return

      list.push(state as RemoteUserState)

      if (state.selection) {
        typing = state.user.name
      }

      // 标题同步：接受远程标题更新
      if (state.docTitle && state.docTitle !== loadDocName(id || '')) {
        titleFromRemoteRef.current = true
        setTitle(state.docTitle)
        saveDocName(id || '', state.docTitle)
      }
    })

    setUsers(list)
    setActiveUser(typing)
  }

  awareness.on('change', handleAwarenessChange)
  return () => {
    awareness.off('change', handleAwarenessChange)
  }
}, [session, id])
```

与原代码的对照：
- 原 Editor.jsx 的 awareness 监听逻辑**基本保留**，但移除了 Quill cursor 的手动管理（`cursors.createCursor`, `cursors.moveCursor`, `cursors.removeCursor`）——TipTap 的 `CollaborationCursor` 扩展自动处理所有光标渲染
- 添加了 TypeScript 类型注解
- 从 `session.provider.awareness` 获取 awareness 实例（原来是 `provider.awareness`）

> **架构预留**：前端组件不自己判断权限，而是消费后端返回的 `abilities` 对象。本项目阶段一无权限控制，但 `Editor.tsx` 中的操作按钮（PDF/DOCX 导出、编辑/查看切换、标题编辑等）可以预留 `disabled={!abilities?.canEdit}` 这样的绑定点。阶段四实现权限系统后，这些按钮会自动根据后端返回的能力值启用/禁用，不需要改组件逻辑。阶段一可以先不做这个绑定（所有按钮始终可用）。

#### 5.3.6 移除 Socket.IO 代码

**整段删除**原 Editor.jsx 中的 Socket.IO 相关代码：
```javascript
// 全部删除
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const socket = io(API_URL);
socket.emit("join-document", docId);
socket.on("load-document-start", ...);
socket.on("load-document-chunk", ...);
socket.on("load-document", ...);
// 以及 cleanup 中的 socket.disconnect()
```

#### 5.3.7 标题同步

保留原逻辑，适配 TypeScript：

```typescript
// 广播标题变化到其他 peers
useEffect(() => {
  if (!session) return
  if (titleFromRemoteRef.current) {
    titleFromRemoteRef.current = false
    return
  }
  session.provider.awareness.setLocalStateField('docTitle', title)
}, [title, session])

// 持久化标题到 localStorage
useEffect(() => {
  if (id) saveDocName(id, title)
}, [id, title])

// doc ID 变化时重新加载标题
useEffect(() => {
  titleFromRemoteRef.current = false
  if (id) setTitle(loadDocName(id))
}, [id])
```

注意：原 Editor.jsx 有一个 `awarenessRef` + `window.dispatchEvent` 的 workaround 来广播标题变化。这个设计在 TipTap 版本中可以简化——直接在 useEffect 中调用 `session.provider.awareness.setLocalStateField('docTitle', title)` 即可，不需要 custom event。

#### 5.3.8 编辑/查看模式

```typescript
useEffect(() => {
  if (!editor) return
  if (mode === 'view') {
    editor.setEditable(false)
  } else {
    editor.setEditable(true)
  }
}, [mode, editor])
```

变更：`quillRef.current.disable()` / `quillRef.current.enable()` → `editor.setEditable(false)` / `editor.setEditable(true)`

#### 5.3.9 PDF 导出

```typescript
const exportPDF = useCallback(() => {
  const content = document.querySelector('.ProseMirror')
  if (!content) return
  html2pdf()
    .set({ margin: 10, filename: `${title}.pdf`, image: { type: 'jpeg', quality: 0.98 } })
    .from(content)
    .save()
}, [title])
```

唯一变更：选择器从 `.ql-editor` 改为 `.ProseMirror`（TipTap 编辑器的 DOM 类名）。

#### 5.3.10 DOCX 导出（升级为格式化导出）

原项目只是导出纯文本：
```javascript
const blob = new Blob([content.innerText], { type: "..." });
saveAs(blob, `${title}.docx`);
```

新方案用 `docx` 库生成真正的 Word 文档：

```typescript
const exportDocx = useCallback(async () => {
  if (!editor) return

  // 从 TipTap 编辑器获取 JSON 文档结构
  const json = editor.getJSON()
  const paragraphs: Paragraph[] = []

  // 遍历 TipTap JSON 转换为 docx Paragraph
  const convertNode = (node: any) => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const textRuns: TextRun[] = []
      const headingLevel = node.attrs?.level

      if (node.content) {
        for (const child of node.content) {
          if (child.type === 'text') {
            textRuns.push(
              new TextRun({
                text: child.text,
                bold: child.marks?.some((m: any) => m.type === 'bold') || false,
                italics: child.marks?.some((m: any) => m.type === 'italic') || false,
                underline: child.marks?.some((m: any) => m.type === 'underline') ? {} : undefined,
                strike: child.marks?.some((m: any) => m.type === 'strike') || false,
                color: child.marks?.find((m: any) => m.type === 'textStyle')?.attrs?.color,
                size: convertFontSizeToHalfPt(
                  child.marks?.find((m: any) => m.type === 'textStyle')?.attrs?.fontSize
                ),
                font: convertFontFamilyToName(
                  child.marks?.find((m: any) => m.type === 'textStyle')?.attrs?.fontFamily
                ),
              })
            )
          }
        }
      }

      paragraphs.push(
        new Paragraph({
          children: textRuns.length > 0 ? textRuns : [new TextRun('')],
          heading: headingLevel ? (`Heading${headingLevel}` as any) : undefined,
          alignment: convertAlignment(node.attrs?.textAlign),
        })
      )
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      // 列表处理
      if (node.content) {
        for (const item of node.content) {
          if (item.type === 'listItem' && item.content) {
            for (const child of item.content) {
              convertNode(child) // 递归转换列表项内容为段落
            }
          }
        }
      }
    } else if (node.type === 'blockquote') {
      if (node.content) {
        for (const child of node.content) {
          convertNode({ ...child, type: 'paragraph' }) // 引用块作为普通段落
        }
      }
    }
  }

  if (json.content) {
    for (const node of json.content) {
      convertNode(node)
    }
  }

  const doc = new Document({
    sections: [{ children: paragraphs }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${title}.docx`)
}, [editor, title])
```

辅助函数：
```typescript
// TipTap 的 fontSize 是 "12pt" 格式，docx 需要半磅（half-points）
// 12pt → 24（12 * 2）
function convertFontSizeToHalfPt(fontSize?: string): number | undefined {
  if (!fontSize) return undefined
  const pt = parseInt(fontSize.replace('pt', ''))
  return pt ? pt * 2 : undefined
}

// TipTap 的 fontFamily 是 "Arial, sans-serif"，docx 只需要字体名
function convertFontFamilyToName(fontFamily?: string): string | undefined {
  if (!fontFamily) return undefined
  return fontFamily.split(',')[0].replace(/"/g, '').trim()
}

// TipTap 的 textAlign 值转换为 docX AlignmentType
function convertAlignment(align?: string): any {
  switch (align) {
    case 'center': return 'center'
    case 'right': return 'right'
    case 'justify': return 'justified'
    default: return 'left'
  }
}
```

关键点：
- `editor.getJSON()` 获取 TipTap 的结构化文档（比 innerText 丰富得多）
- 递归遍历 JSON 树，将每个节点转换为 docx 的 Paragraph/TextRun
- 支持：标题级别、粗体/斜体/下划线/删除线、文字颜色、字号、字体、对齐方式
- `Packer.toBlob()` 生成 Blob，用 `file-saver` 下载

#### 5.3.11 selection-change → awareness

```typescript
// 广播本地选区变化（用于远程光标显示）
useEffect(() => {
  if (!editor || !session) return

  const handleSelectionUpdate = ({ editor }: { editor: Editor }) => {
    const { from, to } = editor.state.selection
    session.provider.awareness.setLocalStateField('selection', { from, to })
  }

  editor.on('selectionUpdate', handleSelectionUpdate)
  return () => {
    editor.off('selectionUpdate', handleSelectionUpdate)
  }
}, [editor, session])
```

变更：`quill.on('selection-change', ...)` → `editor.on('selectionUpdate', ...)`

#### 5.3.12 渲染部分（JSX）

```tsx
return (
  <>
    {/* 顶部导航栏——与原项目结构相同，只移除 loadProgress 相关部分 */}
    <div className="topbar">
      <div className="topbar-left">
        <button className="back-btn" onClick={() => navigate('/')} title="Back to documents">
          {/* SVG 不变 */}
        </button>
        <div className="brand">
          {/* SVG 不变 */}
          <input
            className="doc-title-input"
            value={title}
            onChange={handleTitleChange}
            aria-label="Document title"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="topbar-right">
        {/* 协作者头像——与原项目相同 */}
        <div className="avatars" aria-label="Active collaborators">
          {users.slice(0, 5).map((u, i) => (
            <div
              key={i}
              className="avatar"
              style={{ background: u.user?.color || '#1a73e8' }}
              title={u.user?.name || 'User'}
            >
              {(u.user?.name || 'U')[0].toUpperCase()}
            </div>
          ))}
        </div>

        {/* 移除 loadProgress 的 chunk-progress badge */}

        <div className={`conn-badge ${connected ? 'online' : 'offline'}`}>
          <span className="conn-dot" />
          {connected ? 'Connected' : 'Offline'}
        </div>

        <button
          className={`mode-btn ${mode === 'edit' ? 'editing' : 'viewing'}`}
          onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
        >
          {/* SVG + 文字不变 */}
        </button>

        <div className="export-group">
          <button className="export-btn" onClick={exportPDF}>PDF</button>
          <button className="export-btn" onClick={exportDocx}>DOCX</button>
        </div>
      </div>
    </div>

    {/* 编辑器区域 */}
    <div className="editor-shell">
      <div className="editor-container">
        {/* 工具栏——新组件 */}
        <EditorToolbar editor={editor} />

        {/* 状态行 */}
        <div className="editor-meta">
          {activeUser && (
            <span className="typing-indicator">
              <span className="typing-dots">
                <span /><span /><span />
              </span>
              {activeUser} is typing…
            </span>
          )}
          <span className="word-count">
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} characters
          </span>
        </div>

        {/* TipTap 编辑器——替代 Quill 的 div ref */}
        <div className="tiptap-wrapper">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  </>
)
```

渲染部分的变更：
- **移除**: `loadProgress` 的 chunk-progress badge
- **移除**: `<div ref={wrapperRef} className="quill-wrapper" />` — Quill 的手动挂载点
- **新增**: `<EditorToolbar editor={editor} />` — 独立工具栏组件
- **新增**: `<EditorContent editor={editor} />` — TipTap 的编辑器渲染组件
- `className="quill-wrapper"` → `className="tiptap-wrapper"`
- 其他所有 JSX 结构（topbar, avatars, conn-badge, mode-btn, export buttons, typing indicator, word count）**保持不变**

### 🔍 类型检查点 T5：编辑器组件验证

完成 Step 5 后，`FontSize.ts`、`EditorToolbar.tsx`、`Editor.tsx` 已创建。这是最复杂的部分，务必做类型检查：

```bash
cd client
npx --yes typescript@5.7.2 tsc --noEmit --strict --moduleResolution bundler --jsx react-jsx \
  --skipLibCheck \
  src/types/index.ts src/utils/generateId.ts \
  src/services/yjsProvider.ts src/services/storage.ts \
  src/extensions/FontSize.ts \
  src/components/EditorToolbar.tsx src/components/Editor.tsx 2>&1
# 预期：零错误
# 常见错误：
#   - "Property 'setFontSize' does not exist on type 'Commands'" → 检查 FontSize.ts 的 declare module
#   - "Cannot find module '@tiptap/react'" → 正常，未 npm install，--skipLibCheck 可跳过
#   - Editor.tsx 中 docx 的 TextRun 类型 → 可能需要 @types 或 any 断言
```

> ⚠️ 网页仍不可运行。Editor.tsx 是最复杂的文件（500+ 行），类型检查通过说明逻辑结构正确，但运行时行为要等 Step 8 后验证。

---

## Step 6: 其他组件迁移

### 6.1 `client/src/components/DocsPage.jsx` → `DocsPage.tsx`

这个组件改动很小，主要是类型注解：

```typescript
// 新增导入类型
import type { DocumentMeta } from '../types'

// 状态添加类型
const [docs, setDocs] = useState<DocumentMeta[]>([])
// 其他状态类型:
// const [modalOpen, setModalOpen] = useState(false)  — 不变
// const [newName, setNewName] = useState('')  — 不变
// const [deleteTarget, setDeleteTarget] = useState<DocumentMeta | null>(null)
// const [searchQuery, setSearchQuery] = useState('')  — 不变

// 函数参数类型
const cardColor = (id: string): string => { ... }
const timeAgo = (timestamp: number): string => { ... }
const deleteDoc = (id: string): void => { ... }
```

逻辑完全不变。没有 Socket.IO 引用需要移除（DocsPage 只用 localStorage）。

> **架构预留**：文档删除可设计为软删除（设置 `deleted_at`），用户可在回收站恢复。本项目阶段一的 `deleteDoc` 仍然是硬删除（从 localStorage 移除），但 `DocumentMeta` 已预留 `deletedAt` 字段。阶段六实现回收站时，`deleteDoc` 改为设置 `deletedAt = Date.now()`，`getDocs` 过滤 `deletedAt != null` 的文档，新增回收站页面展示 `deletedAt != null` 的文档并提供恢复按钮——组件结构和类型定义已经就绪。

### 6.2 `client/src/App.jsx` → `App.tsx`

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DocsPage from './components/DocsPage'
import Editor from './components/Editor'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DocsPage />} />
        <Route path="/:id" element={<Editor />} />
      </Routes>
    </BrowserRouter>
  )
}
```

唯一变更：文件后缀 `.jsx` → `.tsx`。无逻辑变化。

### 6.3 `client/src/main.jsx` → `main.tsx`

```typescript
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// NOTE: StrictMode is intentionally omitted.
// React StrictMode double-invokes effects in development, which creates
// two Yjs WebSocket providers per tab. With TipTap this is less problematic
// (useEditor handles cleanup), but we keep this off for consistency.
createRoot(document.getElementById('root')!).render(<App />)
```

变更：
- `import App from './App.jsx'` → `import App from './App'`（TypeScript + bundler resolution 不需要扩展名）
- `document.getElementById('root')` 添加 `!` 非空断言（TS strict 模式要求）
- StrictMode 注释更新——TipTap 的 `useEditor` 比 Quill 更好地处理 StrictMode 双挂载，但继续保持不用

### 🔍 类型检查点 T6：全量类型检查

完成 Step 6 后，所有 .ts/.tsx 源文件已创建。可以做一次全量类型检查：

```bash
cd client
npx --yes typescript@5.7.2 tsc --noEmit --strict --moduleResolution bundler --jsx react-jsx \
  --skipLibCheck --esModuleInterop \
  src/types/index.ts src/utils/generateId.ts \
  src/services/yjsProvider.ts src/services/storage.ts \
  src/extensions/FontSize.ts \
  src/components/EditorToolbar.tsx src/components/Editor.tsx \
  src/components/DocsPage.tsx src/App.tsx src/main.tsx 2>&1
# 预期：零错误
# 如果有错误，这是发现问题的最佳时机——还没 npm install，修复类型错误成本低
```

> ⚠️ 网页仍不可运行。此时所有新代码已就绪，但旧 .jsx/.js 文件还在，且未 npm install 新依赖。下一步 Step 7 改 CSS（不影响类型），Step 8 删除旧文件 + npm install 后即可运行。

---

## Step 7: CSS 适配

### 7.1 `client/src/index.css` 修改

#### 7.1.1 移除的样式（Quill 专属）

**整段删除**以下 CSS 区块：
- `/* QUILL FONT CLASSES */` — `.ql-font-*` 类（84-96 行）
- `/* Font picker labels */` — `.ql-snow .ql-picker.ql-font` 相关（98-115 行）
- `/* Font size classes */` — `.ql-size-*` 类（117-132 行）
- `/* Size picker labels */` — `.ql-snow .ql-picker.ql-size` 相关（134-153 行）
- `/* QUILL TOOLBAR */` — `.ql-toolbar.ql-snow` 及所有子选择器（387-479 行）
- `/* QUILL EDITOR CONTENT */` — `.ql-container.ql-snow`, `.ql-editor` 等（481-507 行）
- `/* CURSORS */` — `.ql-cursor-flag`（899-902 行）
- 响应式中的 `.ql-editor { padding: 24px 20px; }`（910 行）

#### 7.1.2 保留的样式

- `/* Design tokens */` — 所有 CSS 变量保留
- `/* Reset & base */` — 基础重置保留
- `/* TOP BAR */` — `.topbar`, `.back-btn`, `.brand`, `.doc-title-input` 等保留
- `/* EDITOR SHELL & CONTAINER */` — `.editor-shell`, `.editor-container`, `.editor-meta` 保留
- `/* DOCS PAGE */` — `.docs-shell`, `.docs-header`, `.docs-grid`, `.doc-card` 等保留
- `/* MODALS */` — `.modal-overlay`, `.modal` 等保留
- `/* RESPONSIVE */` — 响应式保留（移除 `.ql-editor` 引用）
- `/* Scrollbar */` — 滚动条样式保留
- `/* Font stacks */` — `--font-*` 变量保留（TipTap 也需要这些字体）

#### 7.1.3 新增的样式（TipTap / ProseMirror）

```css
/* ═══════════════════════════════════════════════════════════════
   TIPTAP / PROSEMIRROR EDITOR
   ═══════════════════════════════════════════════════════════════ */

/* 编辑器容器 */
.tiptap-wrapper {
  display: flex;
  flex-direction: column;
}

/* ProseMirror 编辑区——替代 .ql-editor */
.ProseMirror {
  min-height: 75vh;
  padding: 40px 64px;
  font-size: 11pt;
  line-height: 1.75;
  color: var(--gray-900);
  background: #fff;
  caret-color: var(--blue-500);
  outline: none;
}

/* 占位符（TipTap Placeholder 扩展） */
.ProseMirror p.is-editor-empty:first-child::before {
  color: var(--gray-400);
  font-style: italic;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* 协作光标 */
.collaboration-cursor__caret {
  border-left: 1px solid #0d0d0d;
  border-right: 1px solid #0d0d0d;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}

.collaboration-cursor__label {
  border-radius: 3px 3px 3px 0;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 0.1rem 0.3rem;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
}

/* TipTap 工具栏样式——替代 .ql-toolbar */
.tiptap-toolbar {
  border: none;
  border-bottom: 1px solid var(--gray-200);
  background: #fff;
  padding: 6px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
}

.tiptap-toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-right: 6px;
  padding-right: 6px;
  border-right: 1px solid var(--gray-200);
}
.tiptap-toolbar-group:last-child {
  border-right: none;
  margin-right: 0;
}

/* 工具栏按钮 */
.tiptap-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: background var(--duration) var(--ease);
  color: var(--gray-700);
}
.tiptap-btn:hover { background: var(--gray-100); color: var(--gray-900); }
.tiptap-btn.is-active { background: var(--blue-100); color: var(--blue-600); }

/* 工具栏下拉框 */
.tiptap-select {
  height: 28px;
  font-size: 13px;
  color: var(--gray-800);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 0 8px;
  cursor: pointer;
  background: transparent;
  outline: none;
  transition: background var(--duration) var(--ease), border-color var(--duration) var(--ease);
}
.tiptap-select:hover { background: var(--gray-100); border-color: var(--gray-300); }
.tiptap-select:focus { background: var(--blue-50); border-color: var(--blue-500); }

/* 颜色选择器 */
.tiptap-color-input {
  width: 28px;
  height: 28px;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0;
  background: transparent;
}

/* 响应式 */
@media (max-width: 768px) {
  .ProseMirror { padding: 24px 20px; }
  .tiptap-toolbar { flex-wrap: wrap; }
}
```

#### 7.1.4 CSS 变量保留说明

`--font-arial`, `--font-times-new-roman` 等 CSS 变量**保留**。虽然 TipTap 不用 `.ql-font-arial` class，但 `@tiptap/extension-font-family` 会直接设置 `style="font-family: Arial, sans-serif"`，浏览器会加载 index.html 中的 Google Fonts。CSS 变量可以在其他地方引用（如 `.ProseMirror` 默认字体）。

---

## Step 8: 删除旧文件

在所有 `.tsx`/`.ts` 文件创建完毕且 T6 类型检查通过后，删除以下旧文件：

```
client/src/App.jsx
client/src/main.jsx
client/src/components/Editor.jsx
client/src/components/DocsPage.jsx
client/src/services/yjsProvider.js
client/src/services/storage.js
client/src/utils/generateId.js
client/vite.config.js          （已被 vite.config.ts 替代）
server/index.js                （已被 server/src/server.ts 替代）
```

> 删除后确认 `client/src/` 下不再有任何 `.jsx`/`.js` 文件，`server/src/` 下只有 `server.ts`。如果 Vite 配置目录下 `vite.config.js` 和 `vite.config.ts` 同时存在，Vite 优先加载 `.ts`，但最好删除旧的避免混淆。

---

## Step 9: 安装依赖 + 编译验证 + 运行测试

### ✅ 验证点 V2：安装依赖 + 编译验证

```bash
# ── 服务端 ──
cd server
npm install              # 安装 TS 工具链 + y-websocket v2 + 类型声明
npx tsc --noEmit       # 类型检查（应零错误）
npm run dev             # 启动后端 → http://localhost:3001

# ── 客户端 ──
cd client
npm install              # 安装 TipTap + React 18 + TS 工具链
npx tsc --noEmit       # 全量类型检查（应零错误）
```

验证清单：
- [ ] `server` 的 `npx tsc --noEmit` 零错误
- [ ] `client` 的 `npx tsc --noEmit` 零错误
- [ ] `server` 的 `npm run dev` 控制台输出 `[server] Running on http://localhost:3001`
- [ ] `client` 的 `npm run dev` 控制台无报错，Vite 输出 `Local: http://localhost:5173/`

> ⚠️ 如果 `npx tsc --noEmit` 报错：回到对应 Step 修复。常见问题：
> - `Cannot find module '@tiptap/react'` → 检查 npm install 是否成功
> - `Property 'setFontSize' does not exist` → 检查 FontSize.ts 的 `declare module`
> - docx 类型不匹配 → 用 `as any` 断言或安装 `@types` 补充

### ✅ 验证点 V3：运行验证

```bash
# 两个终端分别启动
cd server && npm run dev    # 终端 1：后端 3001
cd client && npm run dev    # 终端 2：前端 5173
```

### 9.4 功能验证清单

打开 http://localhost:5173，逐项验证：

- [ ] 文档列表页正常显示
- [ ] 创建文档、删除文档、搜索文档正常
- [ ] 进入编辑器，工具栏完整显示（字体 13 种 + 字号 15 档 + 粗斜体等）
- [ ] 选择字体后文字字体变化
- [ ] 选择字号后文字大小变化
- [ ] 粗体/斜体/下划线/删除线切换正常
- [ ] 文字颜色 / 高亮颜色设置正常
- [ ] 对齐方式切换正常
- [ ] 有序/无序列表正常
- [ ] 缩进正常
- [ ] 链接插入正常
- [ ] 清除格式正常
- [ ] 字数统计实时更新
- [ ] PDF 导出正常
- [ ] DOCX 导出正常（包含格式）
- [ ] 文档标题编辑 + 跨标签同步
- [ ] 编辑/查看模式切换
- [ ] 开两个**不同浏览器**（如 Chrome + Edge）打开同一文档：
  - [ ] 实时同步正常（输入立即出现在另一浏览器）
  - [ ] 远程光标显示（颜色 + 用户名标签）
  - [ ] 协作者头像列表显示其他用户
  - [ ] 连接状态显示 Connected
- [ ] 刷新页面后内容不丢失（IndexedDB 离线缓存）

> ⚠️ **用两个不同浏览器测试**（不要用同一浏览器的两个标签），以排除 BroadcastChannel 同源跨标签干扰——这能确保验证的是真正的 Yjs WebSocket 同步而非本地通道回声。

---

## 文件变更总览

| 操作 | 文件 | 说明 |
|---|---|---|
| 新建 | `server/tsconfig.json` | TypeScript 配置 |
| 新建 | `server/src/server.ts` | 重写服务端（移除 Socket.IO） |
| 修改 | `server/package.json` | 依赖变更 |
| 删除 | `server/index.js` | 旧服务端入口 |
| 修改 | `client/package.json` | 依赖变更（TipTap + TS + React 18） |
| 新建 | `client/tsconfig.json` | TypeScript 配置 |
| 新建 | `client/tsconfig.node.json` | Vite 配置的 TS 配置 |
| 新建 | `client/vite.config.ts` | 替代 vite.config.js + WS 代理 |
| 删除 | `client/vite.config.js` | 旧 Vite 配置 |
| 修改 | `client/index.html` | main.jsx → main.tsx |
| 新建 | `client/src/types/index.ts` | 类型定义 |
| 新建 | `client/src/extensions/FontSize.ts` | 自定义 TipTap 字号扩展 |
| 新建 | `client/src/services/yjsProvider.ts` | 重写（移除 Socket.IO，返回 CollabSession） |
| 删除 | `client/src/services/yjsProvider.js` | 旧 Yjs provider |
| 新建 | `client/src/services/storage.ts` | 类型化 |
| 删除 | `client/src/services/storage.js` | 旧 storage |
| 新建 | `client/src/utils/generateId.ts` | 类型化 |
| 删除 | `client/src/utils/generateId.js` | 旧工具函数 |
| 新建 | `client/src/components/EditorToolbar.tsx` | 工具栏组件（从 Editor.jsx 拆出） |
| 新建 | `client/src/components/Editor.tsx` | 重写编辑器（Quill → TipTap） |
| 删除 | `client/src/components/Editor.jsx` | 旧编辑器 |
| 新建 | `client/src/components/DocsPage.tsx` | 类型化 |
| 删除 | `client/src/components/DocsPage.jsx` | 旧文档页 |
| 新建 | `client/src/App.tsx` | 类型化 |
| 删除 | `client/src/App.jsx` | 旧 App |
| 新建 | `client/src/main.tsx` | 类型化 |
| 删除 | `client/src/main.jsx` | 旧入口 |
| 修改 | `client/src/index.css` | 移除 Quill 样式，新增 TipTap 样式 |

总计：**13 个新建**，**3 个修改**，**10 个删除**。
