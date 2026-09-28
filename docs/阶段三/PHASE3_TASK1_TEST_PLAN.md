# 阶段三 Task 1：测试体系搭建 — 详细计划

> **目标**：为 `NexaDoc` 建立 Vitest 单元测试 + Playwright e2e 测试体系，覆盖后端全部核心模块和前端关键交互，使项目具备回归保障能力。

---

## 目录

- [0. 现状与目标](#0-现状与目标)
- [1. 测试工具与依赖安装](#1-测试工具与依赖安装)
- [2. 后端单元测试](#2-后端单元测试)
  - [2.1 docId.test.ts](#21-docidtestts)
  - [2.2 rbac.test.ts](#22-rbactestts)
  - [2.3 auth.test.ts](#23-authtestts)
  - [2.4 persistence.test.ts](#24-persistencetestts)
  - [2.5 notifications.test.ts](#25-notificationstestts)
  - [2.6 routes/documents.test.ts](#26-routesdocumentstestts)
  - [2.7 routes/sharing.test.ts](#27-routessharingtestts)
  - [2.8 routes/comments.test.ts](#28-routescommentstestts)
  - [2.9 routes/snapshots.test.ts](#29-routessnapshotstestts)
- [3. 前端单元测试](#3-前端单元测试)
  - [3.1 utils/generateId.test.ts](#31-utilsgenerateidtestts)
  - [3.2 services/storage.test.ts](#32-servicesstoragetestts)
  - [3.3 services/api.test.ts](#33-servicesapitestts)
  - [3.4 contexts/AuthContext.test.tsx](#34-contextsauthcontexttesttsx)
  - [3.5 components/LoginPage.test.tsx](#35-componentsloginpagetesttsx)
  - [3.6 components/RegisterPage.test.tsx](#36-componentsregisterpagetesttsx)
  - [3.7 components/DocsPage.test.tsx](#37-componentsdocspagetesttsx)
  - [3.8 components/EditorToolbar.test.tsx](#38-componentseditortoolbartesttsx)
- [4. Playwright e2e 测试](#4-playwright-e2e-测试)
- [5. 配置文件](#5-配置文件)
- [6. npm scripts 与 package.json 变更](#6-npm-scripts-与-packagejson-变更)
- [7. 执行顺序](#7-执行顺序)
- [8. 验收标准](#8-验收标准)

---

## 0. 现状与目标

| 维度 | 现状 | 目标 |
|---|---|---|
| 测试文件数 | 0 | 后端 9 个 + 前端 8 个 + e2e 4 个 = 21 个 |
| 测试框架 | 无 | Vitest（单元）+ Playwright（e2e） |
| 覆盖率 | 0% | 后端核心模块 ≥ 70%，整体 ≥ 50% |
| CI 集成 | 无 | `yarn test` 可在 CI 中运行 |

后端待测源文件清单（12 个）：

| 文件 | 行数 | 核心函数 | 测试优先级 |
|---|---|---|---|
| `server/src/docId.ts` | 49 | `generateDocId`, `decodeDocName` | P0（纯函数，最易测） |
| `server/src/rbac.ts` | 115 | `getAbilities`, `canManageRole`, `resolveAccess` | P0 |
| `server/src/auth.ts` | 130 | `register`, `login`, `requireAuth` | P1 |
| `server/src/persistence.ts` | 127 | `toBuffer`, `mongoPersistence.bindState/writeState` | P1 |
| `server/src/notifications.ts` | 57 | `addConnection`, `removeConnection`, `notifyUser`, `isUserOnline` | P1 |
| `server/src/db.ts` | 40 | `connectDB`, `getDB` | P2（间接覆盖） |
| `server/src/types.ts` | 89 | 类型定义 | 不直接测 |
| `server/src/routes/documents.ts` | 179 | GET/POST/PATCH/DELETE | P1 |
| `server/src/routes/sharing.ts` | 148 | GET/POST/DELETE access | P1 |
| `server/src/routes/comments.ts` | 82 | GET/POST/PATCH comments | P2 |
| `server/src/routes/snapshots.ts` | 124 | GET/POST snapshots, restore | P2 |
| `server/src/server.ts` | 232 | Express app 装配 | 间接覆盖 |

前端待测源文件清单（10 个）：

| 文件 | 行数 | 核心 | 测试优先级 |
|---|---|---|---|
| `client/src/utils/generateId.ts` | 26 | `generateId` 纯函数 | P0 |
| `client/src/services/storage.ts` | 14 | `getDocs`, `saveDocs` | P0 |
| `client/src/services/api.ts` | 169 | `apiFetch`, token 管理, 各 API 模块 | P1 |
| `client/src/contexts/AuthContext.tsx` | 92 | `AuthProvider`, `useAuth` | P1 |
| `client/src/components/LoginPage.tsx` | 95 | 登录表单交互 | P1 |
| `client/src/components/RegisterPage.tsx` | 108 | 注册表单交互 | P2 |
| `client/src/components/DocsPage.tsx` | 386 | 文档列表/创建/删除/搜索 | P2 |
| `client/src/components/EditorToolbar.tsx` | 324 | 工具栏按钮渲染与点击 | P2 |
| `client/src/components/Editor.tsx` | 568 | 导出辅助函数 | P2 |
| `client/src/services/yjsProvider.ts` | 71 | `createYjs` | P3（依赖 WS，难 mock） |

---

## 1. 测试工具与依赖安装

### 1.1 后端 devDependencies（server/package.json）

```jsonc
{
  "vitest": "^2.1.0",
  "@vitest/coverage-v8": "^2.1.0",
  "supertest": "^7.0.0",
  "@types/supertest": "^6.0.0",
  "mongodb-memory-server": "^10.0.0"
}
```

- **vitest**：测试框架，与 Vite 生态一致，零配置支持 TS
- **@vitest/coverage-v8**：V8 引擎覆盖率
- **supertest**：HTTP 断言库，测 Express 路由
- **mongodb-memory-server**：内存 MongoDB，测试时无需外部 DB

### 1.2 前端 devDependencies（client/package.json）

```jsonc
{
  "vitest": "^2.1.0",
  "@vitest/coverage-v8": "^2.1.0",
  "@testing-library/react": "^16.1.0",
  "@testing-library/jest-dom": "^6.6.0",
  "@testing-library/user-event": "^14.5.0",
  "jsdom": "^25.0.0",
  "@playwright/test": "^1.49.0",
  "msw": "^2.6.0"
}
```

- **@testing-library/react**：React 组件测试
- **@testing-library/user-event**：模拟用户交互
- **jsdom**：浏览器环境模拟
- **msw**：Mock Service Worker，拦截 fetch 请求
- **@playwright/test**：e2e 测试

---

## 2. 后端单元测试

### 测试基础设施

所有后端测试共享一个 `mongodb-memory-server` 实例，通过 `server/src/test/setup.ts` 提供全局 setup/teardown：

```ts
// server/src/test/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server'
import { connectDB } from '../db'

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGO_URI = mongoServer.getUri()
  process.env.JWT_SECRET = 'test-secret'
  await connectDB()
})

afterAll(async () => {
  await mongoServer.stop()
})

// 每个测试前清空集合
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
```

### 2.1 docId.test.ts

**文件**：`server/src/docId.test.ts`
**被测**：`server/src/docId.ts`
**类型**：纯函数，无需 DB mock

| 用例 | 输入 | 期望 |
|---|---|---|
| 纯 ASCII 标题 | `"My Document"` | slug = `my-document`，后缀 `-{timestamp}` |
| 带空格和大小写 | `"  Hello World  "` | slug = `hello-world` |
| 中文标题 → fallback | `"我的文档"` | slug 为空 → `doc-{timestamp}` |
| 特殊字符 | `"A & B! C?"` | slug = `a-b-c` |
| 重音字符 | `"café résumé"` | slug = `cafe-resume`（NFKD 去音标） |
| 超长标题 | 100 字符 ASCII | slug ≤ 40 字符 |
| slug 尾部连字符 | `"---hello---"` | slug = `hello`（首尾 `-` 被修剪） |
| decodeDocName 正常 | `/yjs/my-doc-123` | 返回 `my-doc-123` |
| decodeDocName percent-encoded | `/yjs/%E6%88%91%E7%9A%84` | 返回 `我的`（decodeURIComponent） |
| decodeDocName 非法转义 | `/yjs/test%gg` | 返回 `test%gg`（catch 回退原样） |
| decodeDocName 无前缀 | `my-doc` | 返回 `my-doc` |
| decodeDocName 空路径 | `/yjs/` | 返回 `''` |

### 2.2 rbac.test.ts

**文件**：`server/src/rbac.test.ts`
**被测**：`server/src/rbac.ts`
**类型**：`getAbilities`/`canManageRole` 为纯函数；`resolveAccess` 需内存 DB

#### 2.2.1 getAbilities 矩阵测试

| role | canView | canEdit | canDelete | canShare | canComment | canViewHistory |
|---|---|---|---|---|---|---|
| `null` | true | false | false | false | false | false |
| `READER` | true | false | false | false | false | false |
| `COMMENTER` | true | false | false | false | true | false |
| `EDITOR` | true | true | false | false | true | true |
| `ADMIN` | true | true | true | true | true | true |
| `OWNER` | true | true | true | true | true | true |

用 `it.each` 一次覆盖所有 6 种角色。

#### 2.2.2 canManageRole 测试

| 操作者角色 | 目标角色 | 期望 |
|---|---|---|
| OWNER | ADMIN | true |
| ADMIN | EDITOR | true |
| EDITOR | COMMENTER | true |
| COMMENTER | READER | true |
| READER | EDITOR | false |
| EDITOR | ADMIN | false |
| COMMENTER | COMMENTER | true（同级） |

#### 2.2.3 resolveAccess 集成测试（需内存 DB）

前置：插入一条 document 记录 + document_access 记录。

| 场景 | 条件 | 期望 role | 期望 abilities.canEdit |
|---|---|---|---|
| owner 访问自己的文档 | `userId == doc.ownerUserId` | OWNER | true |
| 被邀请为 editor | document_access 有 editor 记录 | EDITOR | true |
| 被邀请为 reader | document_access 有 reader 记录 | READER | false |
| 未被邀请的登录用户 | userId 非空，无 access 记录 | DEFAULT_LINK_ROLE（EDITOR） | true |
| 未登录用户 | userId = null | null | false |
| 文档不存在 | docId 不存在 | 返回 `null` | — |
| 软删除的文档 | `deletedAt != null` | 返回 `null` | — |

### 2.3 auth.test.ts

**文件**：`server/src/auth.test.ts`
**被测**：`server/src/auth.ts` 的 `register`, `login`, `requireAuth`
**类型**：需内存 DB（bcrypt + jwt 真实调用）

#### register 测试

| 场景 | 请求体 | 期望 HTTP 状态 | 期望响应 |
|---|---|---|---|
| 正常注册 | `{ username: "alice", password: "pass123" }` | 201 | 含 `token` + `user.id` |
| 缺用户名 | `{ password: "pass123" }` | 400 | `{ error: "Username and password are required" }` |
| 缺密码 | `{ username: "alice" }` | 400 | 同上 |
| 用户名太短 | `{ username: "a", password: "pass123" }` | 400 | `"at least 2 characters"` |
| 密码太短 | `{ username: "alice", password: "12345" }` | 400 | `"at least 6 characters"` |
| 重复用户名 | 先注册一次再注册同名 | 409 | `"Username already exists"` |
| 含 email | `{ username: "bob", password: "pass123", email: "b@b.com" }` | 201 | user 含 email |

验证点：
- 返回的 token 用 `jwt.verify` 能解出 `id`, `username`, `avatarColor`
- DB 中 users 集合有对应记录，`passwordHash` 不等于明文密码
- `avatarColor` 在预定义调色板里

#### login 测试

| 场景 | 请求体 | 期望 HTTP 状态 |
|---|---|---|
| 正常登录 | 先 register 再 login | 200 |
| 密码错误 | `{ username: "alice", password: "wrong" }` | 401 |
| 用户不存在 | `{ username: "nobody", password: "pass123" }` | 401 |
| 缺字段 | `{}` | 400 |

验证点：
- 登录返回的 token 与注册时不同（每次签发新 token）
- `user.username` 与请求一致

#### requireAuth 中间件测试

| 场景 | 请求 header | 期望 |
|---|---|---|
| 无 header | 无 `authorization` | 401 `"Authentication required"` |
| 非 Bearer | `"Basic abc"` | 401 |
| 合法 token | `"Bearer <valid-jwt>"` | `next()` 被调用，`req.user` 有值 |
| 过期/非法 token | `"Bearer invalid"` | 401 `"Invalid or expired token"` |
| 空 token | `"Bearer "` | 401 |

### 2.4 persistence.test.ts

**文件**：`server/src/persistence.test.ts`
**被测**：`server/src/persistence.ts` 的 `toBuffer`, `mongoPersistence.bindState`, `mongoPersistence.writeState`
**类型**：需内存 DB + Yjs

#### toBuffer 纯函数测试

| 场景 | 输入 | 期望 |
|---|---|---|
| null / undefined | `null` | `Buffer.alloc(0)` |
| 空值 | `''` | `Buffer.alloc(0)` |
| Buffer 输入 | `Buffer.from([1,2,3])` | 等价 Buffer |
| BSON Binary（含 .buffer = Uint8Array） | `{ buffer: new Uint8Array([1,2]) }` | `Buffer.from([1,2])` |
| BSON Binary（含 .buffer = ArrayBuffer） | `{ buffer: new ArrayBuffer(4) }` | 4 字节 Buffer |
| 其他类型 | `42` | `Buffer.alloc(0)` |

#### bindState 测试

| 场景 | 前置条件 | 期望 |
|---|---|---|
| 新文档 | DB 中无该 docId 记录 | DB 新增记录，title = "Untitled Document" |
| 已有 CRDT 状态 | DB 中有 `crdtState: Buffer` | Yjs doc 被应用 update（`Y.encodeStateAsUpdate` 后内容一致） |
| 已有记录但无 crdtState | `crdtState: Buffer.alloc(0)` | 不新增记录，不 applyUpdate |

#### writeState 测试

| 场景 | 前置 | 期望 |
|---|---|---|
| 正常写入 | ydoc 有内容 | DB 中 `crdtState` 更新，`crdtStateSize` 正确，`updateCount` +1 |
| 清除 pending timer | 先触发 `scheduleSave` 再调 writeState | timer 被清除，立即写入一次 |

### 2.5 notifications.test.ts

**文件**：`server/src/notifications.test.ts`
**被测**：`server/src/notifications.ts`
**类型**：纯内存操作，mock WebSocket

| 场景 | 操作 | 期望 |
|---|---|---|
| addConnection 新用户 | `addConnection("u1", ws1)` | `isUserOnline("u1")` = true |
| addConnection 多连接 | 同一用户加两个 ws | 内部 set size = 2 |
| removeConnection | 加后移除 | `isUserOnline` 变 false |
| removeConnection 不存在的用户 | `removeConnection("nobody", ws)` | 不抛错 |
| notifyUser 在线 | ws.readyState = OPEN | `ws.send` 被调用，参数为 JSON.stringify(event) |
| notifyUser 离线 | 无连接 | `ws.send` 不被调用 |
| notifyUser 部分连接断开 | 1 open + 1 closed | 只 send 到 open 的那个 |

Mock 方式：用 `vi.fn()` 创建 mock WebSocket，设 `readyState = 1 (OPEN)`。

### 2.6 routes/documents.test.ts

**文件**：`server/src/routes/documents.test.ts`
**被测**：`server/src/routes/documents.ts`（通过 supertest 挂载 Express app）
**类型**：集成测试，需内存 DB + 真实 auth 流程

测试策略：先通过 `register` 创建用户拿到 token，后续请求带 `Authorization: Bearer <token>`。

| 端点 | 场景 | 期望状态码 | 关键断言 |
|---|---|---|---|
| `GET /api/documents` | 空列表 | 200 | `[]` |
| `GET /api/documents` | 有自己的文档 | 200 | 数组含 1 条，`shared: false`，`abilities.canDelete: true` |
| `GET /api/documents` | 有被分享的文档 | 200 | 数组含 1 条 `shared: true` |
| `POST /api/documents` | 正常创建 | 201 | 含 `id`, `name`, `abilities` |
| `POST /api/documents` | 空 name | 201 | name = "Untitled Document" |
| `GET /:docId/metadata` | 存在且为 owner | 200 | `name` 正确，`abilities.canEdit: true` |
| `GET /:docId/metadata` | 不存在 | 404 | `"Document not found"` |
| `PATCH /:docId/metadata` | owner 改标题 | 200 | DB 中 title 已更新 |
| `PATCH /:docId/metadata` | reader 改标题 | 403 | `"Insufficient permissions"` |
| `DELETE /:docId` | owner 删除 | 200 | DB 中 `deletedAt` 非 null |
| `DELETE /:docId` | reader 删除 | 403 | `"Insufficient permissions"` |
| `DELETE /:docId` | 不存在 | 404 | — |
| 无 token | GET /api/documents | 401 | — |

### 2.7 routes/sharing.test.ts

**文件**：`server/src/routes/sharing.test.ts`
**被测**：`server/src/routes/sharing.ts`

前置：注册 owner + collaborator 两个用户，owner 创建一篇文档。

| 端点 | 场景 | 期望 |
|---|---|---|
| `GET /:docId/access` | 无协作者 | 200，仅含 owner |
| `POST /:docId/share` | owner 邀请 reader | 200，DB 有 access 记录 |
| `POST /:docId/share` | 非 owner 邀请 | 403 |
| `POST /:docId/share` | 邀请不存在用户 | 404 `"User not found"` |
| `POST /:docId/share` | 不存在的 docId | 404 |
| `DELETE /:docId/access/:userId` | owner 移除协作者 | 200，access 记录删除 |
| `DELETE /:docId/access/:userId` | 非 owner 移除 | 403 |

额外验证：`notifyUser` 被 mock，share 时被调用一次（用 `vi.spyOn`）。

### 2.8 routes/comments.test.ts

**文件**：`server/src/routes/comments.test.ts`
**被测**：`server/src/routes/comments.ts`

前置：注册用户 + 创建文档。

| 端点 | 场景 | 期望 |
|---|---|---|
| `GET /:docId/comments` | 空评论 | 200，`[]` |
| `POST /:docId/comments` | 正常评论 | 201，含 `id` |
| `POST /:docId/comments` | 空 body | 400 `"Comment body required"` |
| `POST /:docId/comments` | 纯空格 body | 400 |
| `POST /:docId/comments` | 不存在的 docId | 404 |
| `PATCH /:commentId/resolve` | 正常 resolve | 200，DB 中 `resolved: true` |
| `GET /:docId/comments` | 有评论 | 200，按 `createdAt` 降序 |

### 2.9 routes/snapshots.test.ts

**文件**：`server/src/routes/snapshots.test.ts`
**被测**：`server/src/routes/snapshots.ts`

前置：注册 owner + reader，owner 创建文档。

| 端点 | 场景 | 期望 |
|---|---|---|
| `GET /:docId/snapshots` | owner 查快照 | 200 |
| `GET /:docId/snapshots` | reader 查快照 | 403（无 `canViewHistory`） |
| `POST /:docId/snapshots` | 正常创建 | 201，含 `id` |
| `POST /:docId/snapshots` | content 超 1MB | 413 `"Snapshot content too large"` |
| `POST /:docId/snapshots` | reader 创建 | 403 |
| `POST /:docId/snapshots/:id/restore` | owner 恢复 | 200，含 `crdtState` 数组 + `contentJson` |
| `POST /:docId/snapshots/:id/restore` | 不存在的 snapshotId | 404 |
| `POST /:docId/snapshots/:id/restore` | 非法 snapshotId | 400 |
| `POST /:docId/snapshots/:id/restore` | reader 恢复 | 403（无 `canEdit`） |
| 跨文档恢复 | 用 docA 的 snapshotId 恢复到 docB | 404（documentId 限定） |

---

## 3. 前端单元测试

### 测试基础设施

```ts
// client/src/test/setup.ts
import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
})
```

### 3.1 utils/generateId.test.ts

**文件**：`client/src/utils/generateId.test.ts`
**被测**：`client/src/utils/generateId.ts`
**类型**：纯函数

| 用例 | 输入 | 期望 |
|---|---|---|
| 纯 ASCII | `"Hello World"` | slug = `hello-world`，后缀 `-{timestamp}` |
| 中文 | `"测试文档"` | `doc-{timestamp}` |
| 特殊字符 | `"A&B!C"` | `a-b-c` |
| 空字符串 | `""` | `doc-{timestamp}` |
| 超长 | 100 字符 | slug ≤ 40 |

### 3.2 services/storage.test.ts

**文件**：`client/src/services/storage.test.ts`
**被测**：`client/src/services/storage.ts`
**类型**：需 jsdom localStorage

| 用例 | 前置 | 期望 |
|---|---|---|
| getDocs 空 | localStorage 无 `docs` | `[]` |
| getDocs 正常 | localStorage 有 2 条 | 返回 2 条 |
| getDocs 过滤无效 | localStorage 含 `{}` | 过滤掉无 id/name 的 |
| getDocs JSON 异常 | localStorage = `"garbage"` | `[]`（catch 回退） |
| saveDocs | 写入 2 条 | localStorage 中 JSON.parse 得到 2 条 |

### 3.3 services/api.test.ts

**文件**：`client/src/services/api.test.ts`
**被测**：`client/src/services/api.ts`
**类型**：用 msw 拦截 fetch

#### Token 管理

| 用例 | 期望 |
|---|---|
| `getToken` 无 token | 返回 `null` |
| `setToken` 后 `getToken` | 返回设置的值 |
| `clearToken` 后 `getToken` | `null` |

#### apiFetch 封装

| 用例 | msw 响应 | 期望 |
|---|---|---|
| 正常请求 | 200 `{ ok: true }` | 解析 JSON 返回 |
| 401 响应 | 401 | 抛 `"Unauthorized"`，token 被清除 |
| 非 ok 响应 | 500 `{ error: "boom" }` | 抛 `"boom"` |
| 非 ok 无 error 字段 | 500 | 抛 `"HTTP 500"` |
| 请求带 Authorization | — | mspy 验证 header 含 `Bearer <token>` |

#### 各 API 模块

| API | 方法 | msw 路由 | 验证点 |
|---|---|---|---|
| `authApi.register` | POST | `/api/auth/register` | body 含 username/password/email |
| `authApi.login` | POST | `/api/auth/login` | body 含 username/password |
| `documentsApi.list` | GET | `/api/documents` | 返回数组 |
| `documentsApi.create` | POST | `/api/documents` | body 含 name |
| `documentsApi.getMetadata` | GET | `/api/documents/:id/metadata` | path 参数正确 |
| `documentsApi.updateMetadata` | PATCH | `/api/documents/:id/metadata` | body 含 title |
| `documentsApi.remove` | DELETE | `/api/documents/:id` | — |
| `snapshotsApi.list/create/restore` | GET/POST/POST | 对应路径 | body / path 参数正确 |
| `sharingApi.listAccess/share/removeAccess` | GET/POST/DELETE | 对应路径 | — |
| `commentsApi.list/create/resolve` | GET/POST/PATCH | 对应路径 | — |
| `getNotificationWsUrl` | — | — | URL 格式正确，含 token 参数 |

### 3.4 contexts/AuthContext.test.tsx

**文件**：`client/src/contexts/AuthContext.test.tsx`
**被测**：`client/src/contexts/AuthContext.tsx`
**类型**：用 msw mock authApi，渲染 `<AuthProvider>`

| 用例 | 前置 | 期望 |
|---|---|---|
| 初始状态 loading | 无 token | `loading` 从 true → false，`user` = null |
| 有合法 token | sessionStorage 设 token（用 jwt.sign 模拟） | `user` 非 null，`loading` = false |
| 有过期 token | token payload.exp = 过去时间 | token 被清除，`user` = null |
| 有非法 token | `"garbage.token"` | token 被清除，`user` = null |
| login 成功 | msw 返回 `{ token, user }` | `user` 被设置，token 存入 sessionStorage |
| login 失败 | msw 返回 401 | `error` 被设置，抛异常 |
| register 成功 | msw 返回 `{ token, user }` | 同 login |
| register 失败 | msw 返回 409 | `error` 含错误信息 |
| logout | 先 login 再 logout | `user` = null，token 清除 |
| useAuth 无 Provider | 渲染裸组件 | 抛 `"useAuth must be used within AuthProvider"` |

### 3.5 components/LoginPage.test.tsx

**文件**：`client/src/components/LoginPage.test.tsx`
**被测**：`client/src/components/LoginPage.tsx`
**类型**：渲染组件，需 `<MemoryRouter>` + `<AuthProvider>`

| 用例 | 操作 | 期望 |
|---|---|---|
| 渲染表单 | — | 含 "Sign in" 按钮、username/password 输入框 |
| 按钮初始禁用 | 空输入 | submit 按钮 `disabled` |
| 输入后启用 | 填入 username + password | 按钮 enabled |
| 提交调用 login | 填表 + 点击 submit | `authApi.login` 被调用 |
| 登录成功跳转 | mock login 成功 | `navigate('/')` 被调用 |
| 显示错误 | mock login 401 | 含错误文本 |
| "Create one" 链接 | 点击 | `navigate('/register')` |
| 自动聚焦 | 渲染后 | username input 获得焦点 |

### 3.6 components/RegisterPage.test.tsx

**文件**：`client/src/components/RegisterPage.test.tsx`
**被测**：`client/src/components/RegisterPage.tsx`
**类型**：同 LoginPage

| 用例 | 期望 |
|---|---|
| 渲染表单 | 含 "Sign up" 按钮 |
| 输入验证 | 密码 < 6 字符时按钮禁用或提示 |
| 提交调用 register | `authApi.register` 被调用 |
| 注册成功跳转 | `navigate('/')` |
| 显示错误 | mock 409 → 显示 "Username already exists" |
| 返回登录链接 | 点击 → `navigate('/login')` |

### 3.7 components/DocsPage.test.tsx

**文件**：`client/src/components/DocsPage.test.tsx`
**被测**：`client/src/components/DocsPage.tsx`
**类型**：msw mock `documentsApi.list`，需 `<MemoryRouter>` + `<AuthProvider>`

| 用例 | msw 响应 | 期望 |
|---|---|---|
| 加载中文档列表 | 返回 3 篇文档 | 渲染 3 个卡片 |
| 加载失败 | 500 | 显示错误信息 |
| 空列表 | `[]` | 显示空状态 |
| 搜索过滤 | 3 篇中搜 "test" | 仅显示匹配项 |
| 创建文档 | mock POST 201 | 列表新增一篇 |
| 删除文档 | mock DELETE 200 | 列表减少 |
| 搜索框输入 | 输入 "abc" | 列表按 name 过滤 |
| logout 按钮 | 点击 | `clearToken` 被调用 |

### 3.8 components/EditorToolbar.test.tsx

**文件**：`client/src/components/EditorToolbar.test.tsx`
**被测**：`client/src/components/EditorToolbar.tsx`
**类型**：mock TipTap editor 对象

测试策略：创建一个 mock `editor` 对象，含 `isActive`, `chain().focus().toggleBold().run()` 等方法。

| 用例 | 期望 |
|---|---|
| 渲染所有格式按钮 | 含 Bold, Italic, Underline, Strike 等 |
| Bold 激活态 | `editor.isActive('bold')` = true → Bold 按钮有 active class |
| 点击 Bold | `editor.chain().focus().toggleBold().run()` 被调用 |
| 点击对齐 | 对应 `toggleAlign` 被调用 |
| 字体下拉选择 | `editor.chain().focus().setFontFamily(...)` 被调用 |
| 字号选择 | `editor.chain().focus().setFontSize(...)` 被调用 |
| 颜色选择 | `editor.chain().focus().setColor(...)` 被调用 |
| 链接插入 | 弹出输入框，确认后 `setLink` 被调用 |

---

## 4. Playwright e2e 测试

**目录**：`client/e2e/`
**配置**：`client/playwright.config.ts`

```ts
// client/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'cd ../server && yarn dev',
      port: 3001,
      timeout: 30000,
    },
    {
      command: 'yarn dev',
      port: 5173,
      timeout: 30000,
    },
  ],
})
```

### 4.1 auth.spec.ts — 认证流程

| 场景 | 步骤 | 验证 |
|---|---|---|
| 注册新用户 | → /register → 填表 → 提交 | 跳转到 / (DocsPage) |
| 登录已有用户 | → /login → 填表 → 提交 | 跳转到 / |
| 登录失败 | 输入错误密码 | 显示错误信息 |
| 退出登录 | 登录后点 logout | 跳转到 /login |
| 未登录访问编辑器 | 直接访问 /document/xxx | 重定向到 /login |

### 4.2 document-crud.spec.ts — 文档增删改查

| 场景 | 步骤 | 验证 |
|---|---|---|
| 创建文档 | 点 "New" → 输入名称 → 确认 | 列表出现新文档 |
| 重命名文档 | 打开文档 → 改标题 | 列表更新名称 |
| 删除文档 | 点删除 → 确认 | 列表移除 |
| 搜索文档 | 搜索框输入 | 列表过滤 |
| 打开文档 | 点击卡片 | 进入编辑器页面 |

### 4.3 collaboration.spec.ts — 实时协作

| 场景 | 步骤 | 验证 |
|---|---|---|
| 双窗口编辑 | 两个 browser context 打开同一文档 | A 输入文字 → B 可见 |
| 光标感知 | 两个 context | B 能看到 A 的光标 |
| 离线重连 | 断网再恢复 | 内容同步 |

### 4.4 export.spec.ts — 导出

| 场景 | 步骤 | 验证 |
|---|---|---|
| PDF 导出 | 编辑器中点导出 PDF | 下载事件触发 |
| DOCX 导出 | 点导出 DOCX | 下载事件触发 |

> 注：e2e 需要真实 MongoDB 运行（或 mongodb-memory-server），CI 中用 service container。

---

## 5. 配置文件

### 5.1 server/vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/types.ts', 'src/server.ts'],
      reporter: ['text', 'lcov'],
    },
  },
})
```

### 5.2 client/vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/vite-env.d.ts', 'src/index.css'],
      reporter: ['text', 'lcov'],
    },
  },
})
```

### 5.3 client/playwright.config.ts

见 4.x 节。

### 5.4 新增文件清单

```
server/
  vitest.config.ts
  src/test/
    setup.ts
  src/docId.test.ts
  src/rbac.test.ts
  src/auth.test.ts
  src/persistence.test.ts
  src/notifications.test.ts
  src/routes/documents.test.ts
  src/routes/sharing.test.ts
  src/routes/comments.test.ts
  src/routes/snapshots.test.ts

client/
  vitest.config.ts
  playwright.config.ts
  src/test/
    setup.ts
  src/utils/generateId.test.ts
  src/services/storage.test.ts
  src/services/api.test.ts
  src/contexts/AuthContext.test.tsx
  src/components/LoginPage.test.tsx
  src/components/RegisterPage.test.tsx
  src/components/DocsPage.test.tsx
  src/components/EditorToolbar.test.tsx
  e2e/
    auth.spec.ts
    document-crud.spec.ts
    collaboration.spec.ts
    export.spec.ts
```

**总计**：后端 9 个 + 前端 8 个 + e2e 4 个 = **21 个测试文件**。

---

## 6. npm scripts 与 package.json 变更

### server/package.json

```jsonc
{
  "scripts": {
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### client/package.json

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

---

## 7. 执行顺序

```
Step 1: 安装依赖（server + client）
Step 2: 创建配置文件（vitest.config.ts × 2 + playwright.config.ts）
Step 3: 创建 test/setup.ts（server + client）
Step 4: 后端 P0 纯函数测试（docId + rbac.getAbilities/canManageRole）  ← 最快见效
Step 5: 后端 P1 模块测试（auth + notifications + rbac.resolveAccess + persistence）
Step 6: 后端路由集成测试（documents + sharing + comments + snapshots）
Step 7: 前端 P0 纯函数测试（generateId + storage）
Step 8: 前端 P1 服务层测试（api + AuthContext）
Step 9: 前端 P2 组件测试（LoginPage + RegisterPage + DocsPage + EditorToolbar）
Step 10: Playwright e2e 测试（auth + document-crud + collaboration + export）
Step 11: 运行覆盖率报告，确认达标
```

每一步完成后运行 `yarn test` 确认全绿，再进入下一步。

---

## 8. 验收标准

| 指标 | 目标 |
|---|---|
| 测试文件数 | 21 个 |
| 后端核心模块覆盖率（docId, rbac, auth, persistence, notifications） | ≥ 70% |
| 后端整体覆盖率 | ≥ 50% |
| 前端纯函数覆盖率（generateId, storage） | ≥ 90% |
| 前端整体覆盖率 | ≥ 40% |
| `cd server && yarn test` | 全绿 |
| `cd client && yarn test` | 全绿 |
| `cd client && yarn test:e2e` | 4 个场景通过 |
| 无 TypeScript 编译错误 | — |

---

*本计划为 Task 1 的详细测试设计，执行时按 Step 1-11 顺序逐步实施。*
