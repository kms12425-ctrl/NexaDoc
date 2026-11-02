# M0-2 API / 类型 / revision 契约（定稿）

> 对应计划：`MARKDOWN_EDITOR_DETAILED_PLAN.md` 第 6 节（数据模型）+ 第 7 节（API 设计）
> 状态：冻结
> 日期：2026-11-02
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
  markdownEpoch?: number      // REST 回滚写入后递增，隔离旧协作缓存
  revision?: number           // REST 乐观并发号 / 协作镜像修订号，缺省 0
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
  collaborationEnabled?: boolean
  collaborationEpoch?: number
  crdtState?: string          // 协作 bootstrap，base64 Yjs update
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
  collaborationEnabled?: boolean
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
| GET | `/api/documents/suggest?q=&limit=` | 双链标题补全（当前可见 Markdown） | 登录（按可见范围过滤） | 200 |
| POST | `/api/documents` | 创建（`editorType`/`markdown`/`tags`/`name`） | 登录 | 201 / 400 |
| GET | `/api/documents/:docId/metadata` | 元数据 + abilities | `canView` | 200 / 404 |
| PATCH | `/api/documents/:docId/metadata` | 改 title / tags | `canEdit` | 200 / 400 / 403 / 404 |
| GET | `/api/documents/:docId/markdown` | 读 Markdown + 修订号 | `canView`（须 markdown） | 200 / 404 |
| PUT | `/api/documents/:docId/markdown` | **P0 自动保存**（带 baseRevision） | `canEdit`，仅关闭协作时 | 200 / 400 / 404 / 409 |
| GET | `/api/documents/:docId/links` | 出链 + 反向链接 | `canView`（须 markdown） | 200 / 404 |
| GET | `/api/search?q=&tag=&type=markdown&limit=` | 全文检索 | 登录（按可见范围过滤） | 200 / 400 |
| GET | `/api/tags?q=` | 标签统计/补全 | 登录（按可见范围过滤） | 200 |
| DELETE | `/api/documents/:docId` | 软删除 | `canDelete` | 200 / 403 / 404 |
| PUT | `/api/documents/:docId/preview` | 更新预览 HTML | `canView` | 200 / 403 / 404 / 413 |

> 挂载顺序（`server/src/server.ts`）：`documents → markdown → sharing → comments → snapshots → tags → search → links`，其中 `suggest` 定义在 `/:docId/...` 之前，避免被当作 `docId`。

## 4. revision 乐观并发语义（`routes/markdown.ts`）

**GET** 返回 `{ markdown, revision, updatedAt }`。

**PUT** 请求体 `{ markdown: string, baseRevision: number }`：

1. 校验：`markdown` 为字符串；`Buffer.byteLength ≤ 2MB`（`MAX_MARKDOWN_BYTES`）；`baseRevision` 为安全整数且 `0 ≤ baseRevision < MAX_SAFE_INTEGER`。
2. 权限通过 `resolveAccess`：owner/editor 可写，reader/commenter 不可写；作用域为 `{ docId, editorType:'markdown', deletedAt:null }`。
3. 修订号匹配：`baseRevision === 0` 时匹配 `{ revision:0 } 或 { revision: 不存在 }`；否则匹配 `{ revision: baseRevision }`。
4. 原子更新：`findOneAndUpdate` 一次写入 `$set { markdown, searchText, outgoingLinks, markdownIndexedAt, updatedAt, crdtState: 空, crdtStateSize: 0 }` + `$inc { revision: 1, markdownEpoch: 1 }`，`returnDocument: 'after'`。
5. 成功返回 `{ revision: 新值, updatedAt }`。
6. 未命中 → 读当前文档后返回 `409 { error:'Conflict', markdown, revision, updatedAt }`。
7. `MARKDOWN_COLLAB_ENABLED === 'true'`（P2）→ 直接返回 `409 { error:'Collaboration enabled' }`，交由 Yjs 接管。

> `searchText` / `outgoingLinks` 由 `server/src/markdown/analyze.ts` 在保存时生成，`targetDocId` 经 `resolveLinkTargets.ts` 解析。

## 5. 权限、协作与回滚边界

- 分享开关默认 false：Markdown 仅 owner 可见，Share/access 禁用；非 owner 返回 404。
- `MARKDOWN_SHARING_ENABLED=true`：仅 owner 或 document_access 明确邀请的 reader/commenter/editor 可见；owner 管理分享和删除；editor 可写；reader/commenter 只读。Markdown 不使用富文本默认链接角色，也不接受 administrator/owner 邀请。
- 列表、搜索、标签、补全、双链及反链使用同一可见范围；不可见出链目标 ID 返回 null。Comments/snapshots/preview 仍禁用。
- GET metadata 返回 `collaborationEnabled`。开启协作后，GET markdown 返回原 payload 以及 `collaborationEnabled: true`、`collaborationEpoch` 和 base64 `crdtState`。同一文档并发首次访问必须共享同一个原子播种结果。
- `/yjs/:docId?token=...&epoch=...` 在协作开关为 true 时启用；消息 0/1/3 分别遵循 Yjs sync/awareness/query-awareness。每条消息重新校验权限；reader 的 sync step2 与 update 都不能修改内容。
- 消息 4：客户端请求立即持久化；服务端确认 `{ revision, vector, deletes }`（JSON 字符串）。vector 为 Yjs state vector 字节数组，deletes 为按 clientID 排序的 delete-set 范围 JSON。客户端只有在本地插入与删除均被确认后才显示 Saved。
- Y.Text('markdown') 为协作正文权威；持久化同时更新 markdown/searchText/outgoingLinks 镜像，不覆盖 title/tags/owner。首次播种和无正文变化的重复保存不增加 revision。
- 通知通道复用 `/ws/notifications?token=...`，发送 document-shared/access-revoked/document-metadata-changed；重连后重新请求 metadata。撤销/角色改变同时关闭对应文档连接，删除关闭整个房间的连接。
- 关闭协作后回退 REST；关闭分享后仅 owner 可见。REST 写入清空旧 CRDT 并递增 epoch，重新开启协作后基于最新镜像播种，旧缓存不能自动覆盖新版本。旧离线草稿可下载比对。
- 默认使用单后端进程承载协作房间；启用及回滚操作见用户手册第 12 节。

## 6. 错误码表

| 场景 | 状态码 | 错误信息 |
|------|--------|---------|
| 未登录 | 401 | `Unauthorized` |
| 文档不存在/已删除/当前用户不可见 | 404 | `Document not found` |
| 无编辑权限 | 403 | `Insufficient permissions` |
| Markdown 使用禁用能力，或非 owner 管理分享 | 403 | `This feature is not available for Markdown documents` |
| `editorType` / `type` 非法 | 400 | `Invalid editorType` / `Invalid document type` |
| `markdown` 非字符串 | 400 | `Markdown content must be a string` |
| `markdown` > 2MB | 400 | `Markdown content too large` |
| `baseRevision` 非法 | 400 | `Invalid baseRevision` |
| 修订号不符 | 409 | `Conflict` |
| P2 协作开启后仍 `PUT` | 409 | `Collaboration enabled` |

## 7. 校验规则

- **标签** `normalizeTags`（`markdown/metadata.ts`）：仅字符串；去首尾空格；去开头 `#`；折叠空白；1–30 字符；大小写不敏感去重；≤20 个。
- **搜索**（`routes/search.ts`）：`q` 按空白拆 ≤5 词、`escapeRegExp` 转义；每个词须命中 `title/tags/searchText` 之一（AND of OR）；`tag` 精确匹配（大小写不敏感）；`type` 仅 `markdown`；`limit` 默认 30、上限 50；评分 标题 100 / 标签 50 / 正文 10。
- **补全**（`routes/documents.ts` suggest）：按可见范围过滤 Markdown；前缀优先、更新时间倒序；`limit` 默认 8、上限 20。

