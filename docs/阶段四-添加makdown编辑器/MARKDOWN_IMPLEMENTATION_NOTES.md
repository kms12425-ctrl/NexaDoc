# Markdown 编辑器统一实施与测试记录

> 阶段四（Markdown 编辑器）· P0 交付后的统一事实来源。
> 覆盖：当前能力、历史验证、完整接口、代码位置与后续边界（P2）。
> 计划文档：`MARKDOWN_EDITOR_DETAILED_PLAN.md`；契约定稿：`M0-2_API_TYPES_REVISION_CONTRACT.md`。

## 1. 当前能力（P0 完成范围）

| 能力域 | 内容 | 任务编号 |
|---|---|---|
| 入口与主页 | AppMenu 工作区切换、`/markdown` 同构主页、五类七个模板、列表/删除 | C1–C5 |
| 编辑闭环 | CodeMirror 源码编辑、三态布局（Source/Split/Preview）、滚动同步、格式工具栏、快捷键、双链补全 | B1、B4–B6 |
| 自动保存 | 800ms 防抖保存、300ms 草稿节流、离线/退出 flush、revision 冲突 UI、草稿恢复 | B2 |
| 安全预览 | GFM + 双链渲染、80ms 防抖、不执行原始 HTML | B3 |
| 标签 | 编辑器增删标签、主页标签筛选与计数、PATCH metadata 规范化 | A4、B7、C7 |
| 搜索 | 服务端全文搜索（标题/正文/标签）、摘要与高亮、主页 180ms 防抖 | A7、C6 |
| 双链/反链 | `[[标题]]` 解析与解析、出链/反链面板、改名后 targetDocId 稳定 | A6、A8、C8 |
| 导出 | `.md` / `.html` / `.pdf` / `.docx` 四种格式，文件名清洗，最新未保存源码 | C9–C11 |

## 2. API 接口（P0，全部 `requireAuth`，文档级走 `resolveAccess`，owner-only）

### 2.1 创建与列表

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/documents` | 创建文档；`editorType: "markdown"` 时接收 `markdown`、`tags`，落库 `revision: 0`、规范化标签、生成 searchText |
| `GET` | `/api/documents?type=rich\|markdown\|all` | 列表；Markdown 只返回 owner 文档，不含富文本 |
| `GET` | `/api/documents/:id/metadata` | 元数据；非 owner 或非 Markdown 返回 404 |
| `PATCH` | `/api/documents/:id/metadata` | 更新 `title` / `tags`（整体替换 + 规范化）；非 owner 404 |
| `DELETE` | `/api/documents/:id` | 软删除（`deletedAt`），正文保留 |

### 2.2 正文

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/documents/:id/markdown` | 返回 `{ markdown, revision, updatedAt }` |
| `PUT` | `/api/documents/:id/markdown` | 携带 `{ markdown, baseRevision }`；原子比较更新，`revision` 自增，冲突返回 409；上限 2 MiB |

### 2.3 标签与双链建议

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/tags?q=` | owner 的 Markdown 标签统计（去重、计数、按次数/名称排序，最多 50 条） |
| `GET` | `/api/documents/suggest?q=&limit=` | 双链标题建议（owner-only Markdown，前缀优先，limit 1–20 默认 8） |

### 2.4 搜索

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/search?q=&tag=&type=&limit=` | 全文搜索：多词 AND、标题/标签/正文匹配、owner-only Markdown、相关性排序、摘要与高亮区间；`type` 仅支持 `markdown`，`limit` 1–50 默认 30 |

### 2.5 链接

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/documents/:id/links` | 返回 `{ outgoing, backlinks }`；出链含 `targetDocId`（未解析为 `null`），反链为引用当前文档的 `{ id, title }` |

### 2.6 富文本兼容（Markdown 下禁用）

Markdown 文档的 `POST /share`、`GET/POST /comments`、`GET/POST /snapshots`、`PUT /preview` 等富文本能力返回 403；非 owner 访问上述及 `/metadata`、`/access` 返回 404。Markdown 客户端无 Share / Comments / History 按钮。

## 3. 数据模型与类型契约（摘要，详见 M0-2）

- `DocumentDoc` 扩展字段：`editorType: 'rich' | 'markdown'`、`markdown: string`、`revision: number`、`tags: string[]`、`searchText: string`、`outgoingLinks: Array<{ title: string; label?: string; targetDocId: string | null }>`、`markdownIndexedAt: Date`。
- 客户端 `MarkdownDocumentPayload { markdown: string; revision: number; updatedAt: number }`。
- `MarkdownSaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'conflict'`。
- 约束：正文 ≤ 2 MiB（`MAX_MARKDOWN_BYTES`）；`docId` ASCII 安全（拼入 `/yjs/<docId>` 路径）；标签 ≤ 20 个、单个 ≤ 30 字符；`revision` 从 0 起原子递增。

## 4. 迁移说明

- **启动自动保证索引**（幂等）：`documents` 上 `{ editorType, updatedAt }`、`{ ownerUserId, editorType, updatedAt }`、`{ tags }`、`{ 'outgoingLinks.targetDocId' }` 等。历史数据无需批量迁移。
- **可选脚本**：`server && npm run migrate:markdown`（`src/scripts/migrate-markdown-fields.ts`）只补缺失字段——缺 `editorType` 置 `rich`、缺 `tags` 置 `[]`、缺 `revision` 置 `0`；不动正文、时间戳与 CRDT 状态。执行前确认 `MONGO_URI`、`DB_NAME`。
- **兼容性**：缺省 `editorType` 按 `rich` 处理；Markdown 创建默认 `revision: 0`；旧文档首次进入协作模式由 P2 懒播种，避免内容丢失/重复。

## 5. P2 升级说明（分享 + 多人实时编辑）

P0 严格 owner-only、无 WebSocket 正文通道。P2 升级路径（P0-G3 通过后，按 P2-1–P2-9 串行执行）：

1. **权限扩展**：`resolveAccess` 为 Markdown 增加 reader/editor 角色；列表/搜索/标签/建议/链接从 `ownerUserId` 扩展为 owner + shared（`document_access`）。
2. **协作正文**：`CollabMarkdownSession` 复用 `MarkdownSession` 接口，用 `Y.Text` 替换 REST PUT；`PUT /markdown` 在 `MARKDOWN_COLLAB_ENABLED=true` 时返回 409（避免双写冲突）。
3. **CRDT 播种**：P0 期间创建的 Markdown 首次进入协作时由 persistence 镜像懒播种到 `crdtState`，不重复、不丢内容。
4. **回滚**：关闭协作开关回退到 P0 单用户模式，正文仍可编辑；回滚演练记录配置、迁移、内容保护与回退步骤（`MIGRATION_NOTES.md`，P2 时补）。
5. **只读与通知**：reader 不能写（工具栏隐藏、输入禁用）；撤销访问后通知被移除者。

## 6. 代码位置

- 服务端 P0：`server/src/routes/documents.ts`（创建/列表/元数据/建议）、`markdown.ts`（正文）、`search.ts`、`links.ts`、`tags.ts`；`server/src/markdown/`（`analyze.ts`、`metadata.ts`、`initialSearchText.ts`、`resolveLinkTargets.ts`、`schema.ts`）；权限 `server/src/rbac.ts`、`restrictRoutes.ts`。
- 客户端 P0：`client/src/components/markdown/`（`MarkdownEditor.tsx`、`MarkdownSource.tsx`、`MarkdownPreview.tsx`、`MarkdownToolbar.tsx`、`TagFilter.tsx`、`BacklinksPanel.tsx`、`ExportMenu.tsx`）；`client/src/markdown/`（`contentApi.ts`、`remarkWikiLink.ts`、`session/`、`export/`）。
- 导出：`client/src/markdown/export/`（`sanitizeFilename.ts`、`markdownToHtml.ts`、`markdownToDocx.ts`、`pdfExport.ts`、`download.ts`）。HTML/PDF/DOCX 在 `ExportMenu` 中按需动态 import，避免撑大 MarkdownEditor 懒加载 chunk。

## 7. 测试记录（历史验证）

- **服务端**（`cd server && npm test`）：239 项通过。覆盖数据模型/迁移（`schema`、`metadata`、`persistence`）、鉴权（`auth`、`rbac`）、`docId`、通知，以及 Markdown 全链路——创建/列表/元数据（`markdown-documents`）、正文 `GET/PUT` 与 revision 冲突（`markdown`）、双链分析（`analyze`）、全文搜索（`search`）、出链/反链（`links`）、标签与建议（`tags`）。A10 补齐了 A4/A7/A8/A9 的 30 项用例。
- **客户端**（`cd client && npm test`）：222 项通过。覆盖 `AppMenu`、`DocsPage`、`MarkdownHome`、`MarkdownPreview`、会话与草稿（`LocalMarkdownSession`）、`contentApi`、模板，以及导出模块 12 项（文件名清洗、HTML 输出、DOCX 节点映射）。
- **端到端**：真实后端 e2e（`client/e2e-markdown-live/`，mongodb-memory-server + 真实 server + msedge）覆盖模板创建落库、列表隔离、删除、权限、Yjs 升级拦截、编辑/保存/重载、双链与 XSS、5,000 行、375px；模拟 UI e2e（`client/e2e-markdown/`、`client/e2e/`）覆盖主页/模板/搜索/工作区切换。C12 新增导出/搜索/标签/反链全流程 10 条。

## 8. 后续边界

- **P2（分享 + 多人实时编辑）**：Share UI、Shared with me、共享搜索/标签、`CollabMarkdownSession`、远程光标、只读协作、撤销通知、P2 e2e 与回滚演练（见第 5 节）。
- **P3**：评论（Comments）与版本历史（History）UI。
- **导出降级（P1）**：DOCX 表格映射为纯文本、图片仅保留 alt 文本；PDF 依赖前端 html2pdf.js，复杂排版为已知降级。
- **规模**：`searchText` 上限 500k、单次搜索候选最多 100 条、建议缓存 30s；更大规模检索可替换 Meilisearch。


