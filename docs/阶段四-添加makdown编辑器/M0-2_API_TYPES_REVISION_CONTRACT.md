# M0-2 API / 类型 / revision 契约（定稿）

> 对应计划：`MARKDOWN_EDITOR_DETAILED_PLAN.md` 第 6 节（数据模型）+ 第 7 节（API 设计）
> 状态：冻结
> 日期：2026-10-25
> 说明：本契约以「已落地代码」为准，并标注与计划文档的差异点。

---

## 1. 服务端数据模型（`server/src/types.ts`）

```ts
export type EditorType = 'rich' | 'markdown'

export interface OutgoingLink {
  title: string              // 原始双链标题
  label?: string             // [[标题|显示文字]] 中的显示文字
  targetDocId: string | null // 保存时解析到的文档 ID；未解析为 null
}

export interface DocumentDoc {
  _id?: ObjectId
  docId: string               // 同时用作 Yjs room name
  title: string
  ownerUserId: ObjectId | null
  parentId?: string | null
  deletedAt?: Date | null
  // ── 阶段四新增 ──
  editorType?: EditorType     // 缺省 = 'rich'（兼容历史数据）
  tags?: string[]
  markdown?: string           // P0 权威正文；P2 退化为 Y.Text 镜像
  searchText?: string         // 去语法后的纯文本索引
  outgoingLinks?: OutgoingLink[]
  markdownIndexedAt?: Date
  revision?: number           // 乐观并发号，缺省 0
  // ── 协作字段 ──
  crdtState: Buffer           // P0 对 Markdown 为空；P2 存 Yjs 状态
  crdtStateSize: number
  updateCount: number
  previewHtml?: string        // 文档 HTML 缩略预览（比计划多出此字段）
  createdAt: Date
  updatedAt: Date
}
```

## 2. 客户端类型（`client/src/types/index.ts`）

```ts
export type EditorType = 'rich' | 'markdown'

export interface MarkdownDocumentPayload {
  markdown: string
  revision: number
  updatedAt: number
}

export type MarkdownSaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'conflict'

export interface SearchResult {
  id: string
  name: string
  editorType: EditorType
  tags: string[]
  snippet: string
  highlights: Array<{ start: number; length: number }>
  updatedAt: number
  shared: boolean
  abilities: DocumentAbilities
}

export interface DocumentMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  editorType?: EditorType   // 缺省 rich
  tags?: string[]
  revision?: number
  snippet?: string
  previewHtml?: string
  abilities?: DocumentAbilities
}
```

## 3. API 端点总表

> 所有端点挂 `requireAuth`（`/api/auth/*` 除外）；文档级操作走 `resolveAccess`（`server/src/rbac.ts`）。

| 方法 | 路径 | 用途 | 权限 | 关键状态码 |
|------|------|------|------|-----------|
| POST | `/api/auth/register` | 注册 | 匿名 | 201 |
| POST | `/api/auth/login` | 登录 | 匿名 | 200 |
| GET | `/api/auth/me` | 当前用户 | 登录 | 200 |
| GET | `/api/documents?type=rich\|markdown\|all` | 列表（新增 `type` 过滤） | 登录 | 200 / 400（非法 type） |
| GET | `/api/documents/suggest?q=&limit=` | 双链标题补全（仅 own markdown） | 登录（owner） | 200 |
| POST | `/api/documents` | 创建（`editorType`/`markdown`/`tags`/`name`） | 登录 | 201 / 400 |
| GET | `/api/documents/:docId/metadata` | 元数据 + abilities | `canView` | 200 / 404 |
| PATCH | `/api/documents/:docId/metadata` | 改 title / tags | `canEdit` | 200 / 400 / 403 / 404 |
| GET | `/api/documents/:docId/markdown` | 读 Markdown + 修订号 | `canView`（须 markdown） | 200 / 404 |
| PUT | `/api/documents/:docId/markdown` | **P0 自动保存**（带 baseRevision） | `canEdit` + owner | 200 / 400 / 404 / 409 |
| GET | `/api/documents/:docId/links` | 出链 + 反向链接 | `canView`（须 markdown） | 200 / 404 |
| GET | `/api/search?q=&tag=&type=markdown&limit=` | 全文检索 | 登录（owner） | 200 / 400 |
| GET | `/api/tags?q=` | 标签统计/补全 | 登录（owner） | 200 |
| DELETE | `/api/documents/:docId` | 软删除 | `canDelete` | 200 / 403 / 404 |
| PUT | `/api/documents/:docId/preview` | 更新预览 HTML | `canView` | 200 / 403 / 404 / 413 |

> 挂载顺序（`server/src/server.ts`）：`documents → markdown → sharing → comments → snapshots → tags → search → links`，其中 `suggest` 定义在 `/:docId/...` 之前，避免被当作 `docId`。

## 4. revision 乐观并发语义（`routes/markdown.ts`）

**GET** 返回 `{ markdown, revision, updatedAt }`。

**PUT** 请求体 `{ markdown: string, baseRevision: number }`：

1. 校验：`markdown` 为字符串；`Buffer.byteLength ≤ 2MB`（`MAX_MARKDOWN_BYTES`）；`baseRevision` 为安全整数且 `0 ≤ baseRevision < MAX_SAFE_INTEGER`。
2. 作用域：`{ docId, ownerUserId, editorType:'markdown', deletedAt:null }`。
3. 修订号匹配：`baseRevision === 0` 时匹配 `{ revision:0 } 或 { revision: 不存在 }`；否则匹配 `{ revision: baseRevision }`。
4. 原子更新：`findOneAndUpdate` 一次写入 `$set { markdown, searchText, outgoingLinks, markdownIndexedAt, updatedAt }` + `$inc { revision: 1 }`，`returnDocument: 'after'`。
5. 成功返回 `{ revision: 新值, updatedAt }`。
6. 未命中 → 读当前文档后返回 `409 { error:'Conflict', markdown, revision, updatedAt }`。
7. `MARKDOWN_COLLAB_ENABLED === 'true'`（P2）→ 直接返回 `409 { error:'Collaboration enabled' }`，交由 Yjs 接管。

> `searchText` / `outgoingLinks` 由 `server/src/markdown/analyze.ts` 在保存时生成，`targetDocId` 经 `resolveLinkTargets.ts` 解析。

## 5. P0 权限模型（owner-only）

- 中间件 `server/src/markdown/restrictRoutes.ts` 挂在 `/api/documents/:docId` 前：
  - 非 markdown 文档 → 放行；
  - markdown 文档但非 owner 或已软删 → `404`（避免枚举）；
  - markdown 文档访问 `/share|access|comments|snapshots|preview` → `403`（P0 不支持）。
- `server/src/server.ts` 对 Markdown 文档的 `/yjs` 连接返回 `403 Markdown Collaboration Unavailable`（P0 无协作）。

> **与计划差异**：计划 7.9 节提到用 `MARKDOWN_SHARING_ENABLED` 环境变量控制；实际实现未使用该变量，而是由 `restrictMarkdownRoutes` 结构性阻断分享（P2 需在 `rbac.resolveAccess` 中放开并接入 `document_access`）。仅 `MARKDOWN_COLLAB_ENABLED` 在代码中生效。

## 6. 错误码表

| 场景 | 状态码 | 错误信息 |
|------|--------|---------|
| 未登录 | 401 | `Unauthorized` |
| 文档不存在/已删除/非 owner 访问 Markdown | 404 | `Document not found` |
| 无编辑权限 | 403 | `Insufficient permissions` |
| Markdown 文档使用分享/评论/快照/预览接口 | 403 | `This feature is not available for Markdown documents` |
| `editorType` / `type` 非法 | 400 | `Invalid editorType` / `Invalid document type` |
| `markdown` 非字符串 | 400 | `Markdown content must be a string` |
| `markdown` > 2MB | 400 | `Markdown content too large` |
| `baseRevision` 非法 | 400 | `Invalid baseRevision` |
| 修订号不符 | 409 | `Conflict` |
| P2 协作开启后仍 `PUT` | 409 | `Collaboration enabled` |

## 7. 校验规则

- **标签** `normalizeTags`（`markdown/metadata.ts`）：仅字符串；去首尾空格；去开头 `#`；折叠空白；1–30 字符；大小写不敏感去重；≤20 个。
- **搜索**（`routes/search.ts`）：`q` 按空白拆 ≤5 词、`escapeRegExp` 转义；每个词须命中 `title/tags/searchText` 之一（AND of OR）；`tag` 精确匹配（大小写不敏感）；`type` 仅 `markdown`；`limit` 默认 30、上限 50；评分 标题 100 / 标签 50 / 正文 10。
- **补全**（`routes/documents.ts` suggest）：仅 own markdown；前缀优先、更新时间倒序；`limit` 默认 8、上限 20。

