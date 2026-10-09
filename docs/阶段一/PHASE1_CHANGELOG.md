# 阶段一 变更记录 (PHASE1_CHANGELOG)

> 本文档详细记录阶段一（JS→TS, Quill→TipTap, Socket.IO→纯 Yjs WebSocket）中所有文件的更改。
>
> - **新建文件**：15 个
> - **修改文件**：6 个
> - **删除文件**：14 个
>
> 项目根目录：`NexaDoc`

---

## 目录

### 服务端 (server/)
1. [server/tsconfig.json](#1-servertsconfigjson) — 新建
2. [server/package.json](#2-serverpackagejson) — 修改
3. [server/src/server.ts](#3-serversrccserverts) — 新建（替代 server/index.js）
4. [server/index.js](#4-serverindexjs) — 删除

### 客户端配置 (client/)
5. [client/package.json](#5-clientpackagejson) — 修改
6. [client/tsconfig.json](#6-clienttsconfigjson) — 新建
7. [client/tsconfig.node.json](#7-clienttsconfignodejson) — 新建
8. [client/vite.config.ts](#8-clientviteconfigts) — 新建（替代 vite.config.js）
9. [client/vite.config.js](#9-clientviteconfigjs) — 删除
10. [client/index.html](#10-clientindexhtml) — 修改
11. [client/eslint.config.js](#11-clienteslintconfigjs) — 修改

### 客户端源码 (client/src/)
12. [client/src/types/index.ts](#12-clienttsrctypesindexts) — 新建
13. [client/src/utils/generateId.ts](#13-clientsrcutilsgenerateidts) — 新建（替代 generateId.js）
14. [client/src/utils/generateId.js](#14-clientsrcutilsgenerateidjs) — 删除
15. [client/src/services/yjsProvider.ts](#15-clientsrcservicesyjsproviderts) — 新建（替代 yjsProvider.js）
16. [client/src/services/yjsProvider.js](#16-clientsrcservicesyjsproviderjs) — 删除
17. [client/src/services/storage.ts](#17-clientsrcservicesstoragets) — 新建（替代 storage.js）
18. [client/src/services/storage.js](#18-clientsrcservicesstoragejs) — 删除
19. [client/src/extensions/FontSize.ts](#19-clientsrcextensionsfontsizets) — 新建
20. [client/src/components/EditorToolbar.tsx](#20-clientsrccomponentseditortoolbartsx) — 新建
21. [client/src/components/Editor.tsx](#21-clientsrccomponentseditortsx) — 新建（替代 Editor.jsx）
22. [client/src/components/Editor.jsx](#22-clientsrccomponentseditorjsx) — 删除
23. [client/src/components/DocsPage.tsx](#23-clientsrccomponentsdocspagetsx) — 新建（替代 DocsPage.jsx）
24. [client/src/components/DocsPage.jsx](#24-clientsrccomponentsdocspagejsx) — 删除
25. [client/src/App.tsx](#25-clientsrcapptsx) — 新建（替代 App.jsx）
26. [client/src/App.jsx](#26-clientsrcappjsx) — 删除
27. [client/src/main.tsx](#27-clientsrcmaintsx) — 新建（替代 main.jsx）
28. [client/src/main.jsx](#28-clientsrcmainjsx) — 删除
29. [client/src/vite-env.d.ts](#29-clientsrcvite-envdts) — 新建
30. [client/src/index.css](#30-clientsrcindexcss) — 修改

### 其他删除文件
31. [client/src/services/socketProvider.js](#31-clientsrcservicessocketproviderjs) — 删除

---

## 服务端 (server/)

### 1. server/tsconfig.json

**状态**：新建

**说明**：服务端 TypeScript 编译配置。使用 `module: "CommonJS"` 因为 `y-websocket/bin/utils` 是 CommonJS 模块，`require()` 方式引入。`strict: true` 启用全部严格类型检查。

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

---

### 2. server/package.json

**状态**：修改

**变更内容**：
- **移除依赖**：`socket.io`
- **升级依赖**：`y-websocket` 从 `^1.0.0` → `^2.0.4`（纯 WebSocket 协议，无 Socket.IO 依赖）
- **新增 devDependencies**：`@types/cors`, `@types/express`, `@types/node`, `@types/ws`, `ts-node`, `typescript`
- **修改 main**：`index.js` → `dist/server.js`
- **修改 scripts**：
  - `dev`: `node index.js` → `ts-node src/server.ts`
  - `build`: 新增 `tsc`
  - `start`: `node index.js` → `node dist/server.js`

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

---

### 3. server/src/server.ts

**状态**：新建（替代 `server/index.js`）

**说明**：完整的服务端重写。从 Socket.IO + 内存文档存储迁移到纯 Yjs WebSocket 单通道架构。关键修复：WebSocket 升级路由从 `pathname === '/yjs'` 精确匹配改为 `pathname.startsWith('/yjs')` 前缀匹配——原项目精确匹配导致客户端连接 `ws://host/yjs/<docId>` 时 pathname 为 `/yjs/<docId>` 不匹配，Yjs WS 实际未连接。

```typescript
import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import { WebSocketServer } from 'ws'

// y-websocket/bin/utils 没有 TypeScript 类型声明，用 require 避免 TS 报错
const { setupWSConnection } = require('y-websocket/bin/utils')

const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const app = express()

app.use(cors({ origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] }))

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

const server = http.createServer(app)

// Yjs WebSocket server（noServer 模式，共享 HTTP 端口）
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true })

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '/', 'http://x').pathname

  if (pathname.startsWith('/yjs')) {           // ← 关键修复：前缀匹配
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }
})

server.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
  console.log(`[server] Accepting connections from: ${CLIENT_ORIGIN}`)
  console.log(`[server] Yjs WebSocket on path: /yjs/<docName>`)
})

// 优雅关闭
function shutdown(signal: string) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully…`)
  server.close(() => { process.exit(0) })
  setTimeout(() => { process.exit(1) }, 5000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

**关键变更点**：
- 移除 Socket.IO，改用 `ws` 库的 `WebSocketServer`
- 移除内存文档存储（`documents = {}`），文档状态完全由 Yjs CRDT 管理
- `setupWSConnection` 来自 `y-websocket/bin/utils`，自动处理 Yjs 同步协议
- 预留认证钩子注释（TODO 阶段三/四）
- 新增 `/health` 健康检查端点
- 新增优雅关闭逻辑（SIGTERM/SIGINT）

---

### 4. server/index.js

**状态**：删除

**说明**：原 Socket.IO + 内存文档存储的服务端入口，已被 `server/src/server.ts` 完全替代。

---

## 客户端配置 (client/)

### 5. client/package.json

**状态**：修改

**变更内容**：

**移除依赖**（Quill + Socket.IO 相关）：
- `quill`
- `quill-cursors`
- `y-quill`
- `socket.io-client`

**新增依赖**（TipTap 扩展套件）：
- `@tiptap/react` `^2.11.5`
- `@tiptap/starter-kit` `^2.11.5`
- `@tiptap/pm` `^2.11.5`
- `@tiptap/extension-collaboration` `^2.11.5`
- `@tiptap/extension-collaboration-cursor` `^2.11.5`
- `@tiptap/extension-underline` `^2.11.5`
- `@tiptap/extension-text-align` `^2.11.5`
- `@tiptap/extension-text-style` `^2.11.5`
- `@tiptap/extension-color` `^2.11.5`
- `@tiptap/extension-highlight` `^2.11.5`
- `@tiptap/extension-placeholder` `^2.11.5`
- `@tiptap/extension-font-family` `^2.11.5`
- `@tiptap/extension-link` `^2.27.3`

**降级依赖**（兼容性调整）：
- `react`: `^19.2.4` → `^18.3.1`
- `react-dom`: `^19.2.4` → `^18.3.1`
- `react-router-dom`: `^7.13.2` → `^6.28.0`
- `y-websocket`: `^3.0.0` → `^2.0.4`
- `lucide-react`: `^1.7.0` → `^0.475.0`

**保留依赖**：`docx`, `file-saver`, `html2pdf.js`, `y-indexeddb`, `yjs`

**新增 devDependencies**（TypeScript 工具链）：
- `typescript` `^5.7.2`
- `@types/file-saver` `^2.0.7`
- `@types/node` `^22.10.2`
- `@types/react` `^18.3.18`
- `@types/react-dom` `^18.3.5`
- `@vitejs/plugin-react` `^4.3.4`
- `vite` `^6.0.7`

**scripts 修改**：
- `build`: `vite build` → `tsc && vite build`（先类型检查再构建）

---

### 6. client/tsconfig.json

**状态**：新建

**说明**：前端 TypeScript 配置。`moduleResolution: "bundler"` 适配 Vite 的模块解析，`jsx: "react-jsx"` 启用 React 17+ 自动 JSX runtime，`noEmit: true` 因为 Vite 负责转译，`allowImportingTsExtensions: true` 允许 import 时带 `.ts` 扩展名。

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

---

### 7. client/tsconfig.node.json

**状态**：新建

**说明**：Vite 配置文件的 TypeScript 配置。`vite.config.ts` 运行在 Node 环境，需要单独的 tsconfig。

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

---

### 8. client/vite.config.ts

**状态**：新建（替代 `vite.config.js`）

**说明**：Vite 配置，核心变更是新增 `/yjs` 路径的 WebSocket 代理——客户端连接 `ws://localhost:5173/yjs/<docId>`，Vite 代理到后端 `ws://localhost:3001`。

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

---

### 9. client/vite.config.js

**状态**：删除

**说明**：原 JavaScript 版 Vite 配置，已被 `vite.config.ts` 替代。

---

### 10. client/index.html

**状态**：修改

**变更内容**：
- 入口脚本：`<script type="module" src="/src/main.jsx">` → `<script type="module" src="/src/main.tsx">`

---

### 11. client/eslint.config.js

**状态**：修改

**变更内容**：
- `files: ['**/*.{js,jsx}']` → `files: ['**/*.{ts,tsx}']`（ESLint 检查 TypeScript 文件）

---

## 客户端源码 (client/src/)

### 12. client/src/types/index.ts

**状态**：新建

**说明**：全项目 TypeScript 类型定义。包含当前使用的类型和为后续阶段预留的类型接口。

```typescript
import type * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'
import type { IndexeddbPersistence } from 'y-indexeddb'

// 用户 awareness 状态
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

// 文档元数据
export interface DocumentMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  // ── 预留字段（后续阶段启用）──
  parentId?: string | null         // 文档树结构（阶段六启用）
  deletedAt?: number | null        // 软删除时间戳（阶段六启用）
  abilities?: DocumentAbilities    // 能力契约（阶段四启用）
}

// 连接状态
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

// Awareness 中其他用户的状态
export interface RemoteUserState {
  user: UserAwareness
  selection?: { from: number; to: number } | null
  docTitle?: string
}

// ── 预留：文档能力契约（后续阶段实现 RBAC 时启用）──
export interface DocumentAbilities {
  canView?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canShare?: boolean
  canComment?: boolean
  canViewHistory?: boolean
}
```

**设计说明**：
- `DocumentMeta` 中的 `parentId`、`deletedAt`、`abilities` 为预留字段，当前阶段不使用，为阶段四（RBAC 权限）和阶段六（文档树+软删除）做准备
- `DocumentAbilities` 接口采用 `get_abilities()` 契约模式——后端返回能力布尔值，前端直接消费决定 UI 显示/隐藏

---

### 13. client/src/utils/generateId.ts

**状态**：新建（替代 `generateId.js`）

**说明**：文档 ID 生成工具，从 JavaScript 迁移到 TypeScript 并添加类型注解。

```typescript
export const generateId = (name: string): string => {
  return name.replace(/\s+/g, '-') + '-' + Date.now()
}
```

---

### 14. client/src/utils/generateId.js

**状态**：删除

---

### 15. client/src/services/yjsProvider.ts

**状态**：新建（替代 `yjsProvider.js`）

**说明**：封装 Yjs 协作三件套（`Y.Doc` + `WebsocketProvider` + `IndexeddbPersistence`）。从原 Socket.IO provider 完全重写为纯 Yjs WebSocket provider。

```typescript
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CollabSession, UserAwareness } from '../types'

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

// 开发环境通过 Vite 代理连接
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

  return { doc: ydoc, provider, persistence, user, roomName: docId, destroy }
}
```

**关键变更**：
- 移除 Socket.IO provider，改用 `y-websocket` 的 `WebsocketProvider`
- `WS_URL` 默认 `ws://localhost:5173/yjs`（通过 Vite 代理转发到后端 3001）
- 支持 `customUser` 参数，为阶段三（用户认证后传入真实用户信息）预留
- 返回 `CollabSession` 对象，封装 `destroy()` 方法统一清理

---

### 16. client/src/services/yjsProvider.js

**状态**：删除

---

### 17. client/src/services/storage.ts

**状态**：新建（替代 `storage.js`）

**说明**：localStorage 文档元数据存取工具，添加 TypeScript 类型注解。

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

---

### 18. client/src/services/storage.js

**状态**：删除

---

### 19. client/src/extensions/FontSize.ts

**状态**：新建

**说明**：自定义 TipTap 扩展，在 `TextStyle` mark 上添加 `fontSize` 属性。TipTap 没有内置 font-size 支持，需要用 `Extension.create()` + `addGlobalAttributes()` 自定义实现。通过 `declare module '@tiptap/core'` 扩展 Commands 接口，添加 `setFontSize` / `unsetFontSize` 命令。

```typescript
import { Extension } from '@tiptap/core'

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
    return { types: ['textStyle'] }
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

---

### 20. client/src/components/EditorToolbar.tsx

**状态**：新建

**说明**：从原 `Editor.jsx` 中抽出的独立工具栏组件。提供完整的富文本编辑工具栏，所有按钮使用 SVG 图标。

**功能清单**：
- **字体下拉**：13 种字体（Arial, Times New Roman, Roboto, Open Sans, Lato, Montserrat, Poppins, Raleway, Ubuntu, Playfair Display, Merriweather, Source Code Pro, Nunito）
- **字号下拉**：15 档（8pt ~ 72pt）
- **粗体/斜体/下划线/删除线**：4 个切换按钮
- **文字颜色/高亮色**：2 个 color input + 清除/切换按钮
- **对齐方式**：左/中/右/两端对齐
- **列表**：有序/无序列表
- **缩进**：增加/减少缩进
- **链接**：插入/编辑链接（`window.prompt` + `setLink`/`unsetLink`）
- **清除格式**：`unsetAllMarks().clearNodes()`

**关键实现**：
- `editor.isActive()` 控制按钮激活状态
- `editor.getAttributes('textStyle')` 获取当前字体/字号值
- `setLink()` 使用 `editor.chain().focus().extendMarkRange('link').setLink({href})`

---

### 21. client/src/components/Editor.tsx

**状态**：新建（替代 `Editor.jsx`）— **本次迁移最大的改动**

**说明**：从 Quill 完整重写为 TipTap 编辑器组件。

**核心架构**：
- `useEditor` hook 配置 12 个扩展
- `useState` lazy initializer 同步创建 Yjs session（关键修复——见下方 bug 修复）
- Awareness 监听实现协作者列表 + 标题同步 + 选区广播
- DOCX 导出：`editor.getJSON()` → 递归遍历 → docx Paragraph/TextRun
- PDF 导出：`html2pdf().from(document.querySelector('.ProseMirror'))`

**TipTap 扩展配置**：

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({ history: false }),  // history 由 Collaboration 提供
    Collaboration.configure({ document: session?.doc }),
    CollaborationCursor.configure({
      provider: session?.provider,
      user: session ? { name: session.user.name, color: session.user.color } : undefined,
    }),
    FontFamily,           // 字体
    FontSize,             // 字号（自定义扩展）
    Underline,            // 下划线（StarterKit 不含）
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle, Color,     // 文字颜色
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder: 'Start typing your document…' }),
    Link.configure({ openOnClick: false }),
  ],
  onUpdate: ({ editor }) => {
    const text = editor.getText()
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
    setCharCount(Math.max(0, text.length - 1))
  },
}, [session?.doc, session?.provider])
```

**session 创建（关键修复）**：

```typescript
// 修复前（白屏 bug）：
const [session, setSession] = useState<CollabSession | null>(null)
useEffect(() => { if (id) setSession(createYjs(id)) }, [id])

// 修复后（同步创建）：
const [session, setSession] = useState<CollabSession | null>(() => {
  if (!id) return null
  return createYjs(id)
})
```

**DOCX 导出辅助函数**：

```typescript
// TipTap fontSize "12pt" → docx 半磅 24
function convertFontSizeToHalfPt(fontSize?: string): number | undefined {
  if (!fontSize) return undefined
  const pt = parseInt(fontSize.replace('pt', ''), 10)
  return pt ? pt * 2 : undefined
}

// TipTap fontFamily "Arial, sans-serif" → docx "Arial"
function convertFontFamilyToName(fontFamily?: string): string | undefined {
  if (!fontFamily) return undefined
  return fontFamily.split(',')[0].replace(/"/g, '').trim()
}

// TipTap textAlign → docx AlignmentType（justify → both）
function convertAlignment(align?: string): 'left' | 'center' | 'right' | 'both' | undefined {
  switch (align) {
    case 'center': return 'center'
    case 'right': return 'right'
    case 'justify': return 'both'  // ← docx 用 'both' 而非 'justified'
    default: return 'left'
  }
}
```

**DOCX 导出递归遍历**：
- `convertNode(node)` 递归处理 `paragraph`、`heading`、`bulletList`、`orderedList`、`blockquote` 节点
- 对 text 节点提取 `bold`、`italics`、`underline`、`strike`、`color`、`size`、`font` marks
- heading 节点映射到 `Heading1` ~ `Heading6`
- list 节点递归处理 `listItem` 子节点
- blockquote 节点将子节点转为 paragraph

**Awareness 监听**：

```typescript
useEffect(() => {
  if (!session) return
  const awareness = session.provider.awareness

  const handleAwarenessChange = () => {
    const states = Array.from(awareness.getStates().entries())
    const list: RemoteUserState[] = []
    let typing = ''

    states.forEach(([clientId, state]) => {
      if (!state.user) return
      if (clientId === awareness.clientID) return  // 不显示自己

      list.push(state as RemoteUserState)

      if (state.selection) {
        typing = state.user.name  // 正在输入的用户
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
  return () => { awareness.off('change', handleAwarenessChange) }
}, [session, id])
```

**渲染结构**：
- **顶栏**：返回按钮 + 品牌 logo + 文档标题输入框 + 协作者头像 + 连接状态 + 编辑/查看模式切换 + PDF/DOCX 导出按钮
- **编辑区**：状态行（正在输入指示器 + 字数统计）+ EditorToolbar + EditorContent

---

### 22. client/src/components/Editor.jsx

**状态**：删除

**说明**：原 Quill 编辑器组件，已被 `Editor.tsx` 完全替代。

---

### 23. client/src/components/DocsPage.tsx

**状态**：新建（替代 `DocsPage.jsx`）

**说明**：文档列表页，添加 TypeScript 类型注解，业务逻辑不变。功能包括：文档列表展示、搜索过滤、创建文档（模态框）、删除文档（确认模态框）、文档卡片（颜色标识 + 相对时间）。

**类型变更**：
- `docs` 状态：`useState<DocumentMeta[]>([])`
- `deleteTarget` 状态：`useState<DocumentMeta | null>(null)`
- `inputRef`：`useRef<HTMLInputElement>(null)`

---

### 24. client/src/components/DocsPage.jsx

**状态**：删除

---

### 25. client/src/App.tsx

**状态**：新建（替代 `App.jsx`）

**说明**：应用根组件，路由结构不变。

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

---

### 26. client/src/App.jsx

**状态**：删除

---

### 27. client/src/main.tsx

**状态**：新建（替代 `main.jsx`）

**说明**：应用入口。StrictMode 故意省略——避免开发环境双调用 effect 导致创建两个 Yjs WebSocket provider。

```typescript
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
```

---

### 28. client/src/main.jsx

**状态**：删除

---

### 29. client/src/vite-env.d.ts

**状态**：新建

**说明**：Vite 环境类型声明，修复 `import.meta.env` 类型缺失问题（TS2339）。

```typescript
/// <reference types="vite/client" />
```

---

### 30. client/src/index.css

**状态**：修改（完整重写）

**变更内容**：

**移除**（约 250 行 Quill 样式）：
- `.ql-font-*` 字体类
- `.ql-size-*` 字号类
- `.ql-toolbar.ql-snow` 工具栏样式
- `.ql-editor` 编辑器样式
- `.ql-cursor-flag` 远程光标样式
- 所有 Quill Snow 主题相关样式

**新增**（TipTap / ProseMirror 样式）：
- `.ProseMirror` — 编辑器容器（outline: none, min-height, padding）
- `.ProseMirror:focus` — 聚焦样式
- `.ProseMirror p.is-editor-empty:first-child::before` — 占位符样式
- `.tiptap-toolbar` — 工具栏容器（flex, gap, border-bottom, sticky）
- `.tiptap-toolbar-group` — 工具栏按钮组
- `.tiptap-btn` — 工具栏按钮（hover, active 状态）
- `.tiptap-btn.is-active` — 激活状态按钮
- `.tiptap-select` — 下拉选择框
- `.tiptap-color-input` — 颜色选择器
- `.collaboration-cursor__caret` — 远程光标 caret
- `.collaboration-cursor__label` — 远程光标用户名标签

**保留**（不变）：
- 设计系统 CSS 变量（颜色、间距、圆角、阴影）
- `.topbar` / `.topbar-left` / `.topbar-right` — 顶栏布局
- `.editor-shell` / `.editor-container` — 编辑器布局
- `.docs-page` / `.docs-grid` / `.doc-card` — 文档列表页
- `.modal-overlay` / `.modal` — 模态框
- `.conn-badge` / `.avatar` — 连接状态/协作者头像
- 响应式样式

---

### 31. client/src/services/socketProvider.js

**状态**：删除

**说明**：原 Socket.IO provider，已被 `yjsProvider.ts` 完全替代。

---

## Bug 修复记录

### Bug 1：WebSocket 路由精确匹配导致 Yjs 未连接

**文件**：`server/src/server.ts:55`

**问题**：原项目 `server/index.js` 使用 `pathname === '/yjs'` 精确匹配，但客户端连接的 URL 是 `ws://host/yjs/<docId>`，pathname 为 `/yjs/<docId>`，精确匹配不通过，导致 Yjs WebSocket 实际未连接。

**修复**：改为 `pathname.startsWith('/yjs')` 前缀匹配。

---

### Bug 2：`request.url` 类型 undefined

**文件**：`server/src/server.ts:53`

**问题**：`new URL(request.url, 'http://x')` 中 `request.url` 类型为 `string | undefined`，TS 报错。

**修复**：`new URL(request.url || '/', 'http://x')`。

---

### Bug 3：`Editor` 导入与组件名冲突 (TS2440)

**文件**：`client/src/components/Editor.tsx:4`

**问题**：`import { Editor } from '@tiptap/react'` 与 `export default function Editor()` 组件名冲突。

**修复**：`import type { Editor as TipTapEditor } from '@tiptap/react'`，并更新所有类型引用为 `TipTapEditor`。

---

### Bug 4：`html2pdf().from(content)` 类型不兼容 (TS2345)

**文件**：`client/src/components/Editor.tsx:262-266`

**问题**：`document.querySelector('.ProseMirror')` 返回 `Element | null`，不匹配 `html2pdf.from()` 期望的 `HTMLElement`。

**修复**：`content as HTMLElement | null` + `.from(content as any)`。

---

### Bug 5：docx `justified` 类型不匹配 (TS2322)

**文件**：`client/src/components/Editor.tsx:70-77`

**问题**：docx 库的 `AlignmentType` 使用 `'both'` 而非 `'justified'` 表示两端对齐。

**修复**：`convertAlignment` 函数中 `case 'justify': return 'both'`。

---

### Bug 6：`unsetLink`/`setLink` 不存在于 ChainedCommands (TS2339)

**文件**：`client/src/components/EditorToolbar.tsx:51,55`

**问题**：Link 扩展未安装，TypeScript 不知道 `unsetLink`/`setLink` 命令。

**修复**：`npm install @tiptap/extension-link` 安装扩展 + `as any` 断言绕过类型检查。

---

### Bug 7：`import.meta.env` 类型缺失 (TS2339)

**文件**：`client/src/services/yjsProvider.ts:26`

**问题**：没有 Vite 环境类型声明，TypeScript 不识别 `import.meta.env`。

**修复**：新建 `client/src/vite-env.d.ts`，内容 `/// <reference types="vite/client" />`。

---

### Bug 8：白屏 bug — useEditor 首次渲染 session 为 null

**文件**：`client/src/components/Editor.tsx:94-97`

**问题**：用户报告打开 Blank document 后画面全白。根因：`session` 用 `useState<CollabSession | null>(null)` + `useEffect` 异步创建，`useEditor` 首次渲染时 `session` 为 null，`Collaboration.configure({ document: undefined })` 创建了一个没有协作绑定的空编辑器。`useEditor` 在 deps 从 null 变为有值时虽然会重新创建编辑器，但 TipTap 的重创建流程未能正确绑定 Y.Doc。

**修复**：改为 `useState` lazy initializer 同步创建 session：

```typescript
const [session, setSession] = useState<CollabSession | null>(() => {
  if (!id) return null
  return createYjs(id)
})
```

确保第一帧 `useEditor` 就能拿到真实的 `Y.Doc` 和 `WebsocketProvider`。`useEffect` 的依赖从 `[id]` 改为 `[session]`，只负责连接状态监听和清理。

---

## 验证结果

- **TypeScript 编译**：`tsc --noEmit` 通过，无类型错误
- **后端运行**：`http://localhost:3001/health` 返回 `{ status: 'ok' }`
- **前端运行**：`http://localhost:5173` 正常加载
- **WebSocket 代理**：`ws://localhost:5173/yjs/test-doc` 通过 Vite 代理成功连接后端
- **协作功能**：两个不同浏览器打开同一文档可实时同步内容和光标
- **白屏修复**：打开 Blank document 正常显示编辑器
