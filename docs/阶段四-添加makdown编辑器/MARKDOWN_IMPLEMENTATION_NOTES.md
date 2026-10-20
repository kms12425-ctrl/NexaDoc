# Markdown 统一实施与测试记录

记录范围：2026-10-19 至 2026-10-20 已实现的阶段四功能。

本文统一承接原 C1/C2/C3、C4/C5、A1/A2/A3、B1/B2/B3 四份实施记录，按当前能力去重整理。历史测试数量与当时限制集中保留在第 9 节；不再把“主页骨架”“后端尚未接入”“接口默认关闭”等历史状态混作当前说明。

任务编号保持 A/B/C 原编号不变。执行顺序、每项当前状态和剩余验收以[计划书第 12 节](./MARKDOWN_EDITOR_DETAILED_PLAN.md#p0-serial-tasks)的统一串行列表为准；本记录不另建一份全任务看板。

## 1. 当前能力与完成边界

| 已实现范围 | 对应任务 | 当前交付 |
|---|---|---|
| 工作区入口 | C1、C2 | 菜单、登录保护、懒加载、双向类型守卫 |
| 公共组件及主页 | C3、C4、C5 | 同构主页、五类七个模板、命名、创建、列表、标题筛选和软删除 |
| 数据及文档元数据 | A1、A2、A3 | Markdown 模型、索引、可选迁移、类型过滤及权限 |
| 正文接口及分析 | A5、A6 | 正文 GET/PUT、原子修订检查、保存时纯文本/双链索引和目标解析 |
| 基础编辑器 | B1、B2、B3 | CodeMirror、自动保存、草稿恢复、冲突处理和安全实时预览 |
| P0 编辑准备 | B8 | 由 C2、B1/B2 实现类型守卫、保存状态和只读配置；P2 协作只读另验收 |

当前可以完成：**选择模板 → 创建 → 输入源码 → 查看预览 → 自动保存 → 刷新继续编辑**。富文本与 Markdown 分别使用各自主页和编辑器，旧富文本缺少类型字段时仍可使用。

当前尚不具备完整的三态布局、同步滚动、格式工具栏、标签编辑/筛选、全文检索、补全、反链面板或 Markdown 导出。基础双链跳转不等于完整链接产品，局部测试通过不等于整期已发布。

所有记录中的数据库验证使用独立临时 MongoDB；没有对开发数据库执行迁移或改写用户文档。当前仍是 Markdown P0 单用户模式，分享、评论、富文本快照和 Yjs 协作不开放。

<a id="menu-routing"></a>

## 2. C1/C2：菜单、路由和类型守卫

### 菜单内容

`AppMenu` 接入 DocsPage、MarkdownHome 和两个编辑器。菜单包含 Docs、Markdown、禁用的 Settings，以及 Help & feedback；底部保留 Privacy Policy / Terms of Service 文案。Help 链接使用新标签页及 `noopener noreferrer`。

新建文档和搜索属于 Markdown 主页。2026-10-19 曾有两个菜单快捷入口，后按用户要求删除，相应 `?new=1`、`?focusSearch=1` 处理也已移除。

菜单支持触发按钮开关、点击外部关闭、Escape 关闭并归还焦点；方向键循环导航，Home/End 跳首尾，跳过禁用项；触发按钮 ArrowDown/ArrowUp 分别从首项/末项进入。Tab 关闭菜单并允许焦点离开。已提供展开状态、关联面板和当前工作区标记。

### 路由及守卫

| 地址 | 当前行为 |
|---|---|
| `/` | 富文本主页，显式请求 `type=rich`，并保留前端防御过滤 |
| `/document/:id` | 元数据确认后挂载富文本编辑器 |
| `/markdown` | Markdown 主页，显式请求 `type=markdown` |
| `/markdown/:id` | 元数据确认后读取正文、创建会话及源码/预览 |
| `/login`、`/register` | 原有认证流程 |

两个 Markdown 页面使用 React.lazy / Suspense。未登录时转到登录页。`DocumentTypeGuard` 在编辑器挂载前读取元数据：

1. 缺少 `editorType` 时视为 rich。
2. 类型不匹配则 replace 到正确编辑路由，保留 query、hash 和路由 state。
3. 确认前不挂载正文编辑器，不建立富文本 Yjs 房间。
4. 错误提供重试；401 清理登录状态；ID 改变或卸载时忽略过期结果。

富文本 Editor 接收已验证的 metadata，避免重复读取及类型确认前建立协作连接，reader 能力沿用原有初始化逻辑。页面导航检查不替代服务端权限。

<a id="shared-home"></a>

## 3. C3/C4/C5：公共组件、主页及七个模板

### 公共组件

`DocumentCard` 负责缩略图插槽、名称、更新时间、普通/共享样式、可选标签/摘要及删除入口。`doc/preview/onOpen/shared/tags/snippet/onDelete` 由父页面传入，卡片不发请求、不绑定编辑器路由。支持鼠标、Enter、空格打开；删除按钮的鼠标/键盘操作不会误打开卡片。

`CreateDocModal` 接收名称、占位、说明和确认/取消回调，并支持可选 submitting、disabled、error。父页面负责模板、默认名称、API 和跳转。名称最多 120 字符；打开后聚焦输入，Tab 约束焦点，关闭后归还焦点。Enter 确认，Escape/取消/遮罩关闭，中文组词时不误提交或关闭。Markdown 请求中禁止重复提交和关闭；错误保留名称及所选模板。原 DocsPage 的默认调用兼容。

### 主页流程

主页复用现有 Docs CSS 和组件，包含品牌、菜单、账户、退出、标题搜索及 New document；模板区五类切换，New document 打开含 All 的完整选择器。

点击模板后命名：名称 trim；空白模板未命名时为 `Untitled document`，其他模板默认模板名称。创建发送原始模板源码，成功跳转 `/markdown/:id`，编辑器从服务端读取正文，不通过路由 state 暂存正文。

列表有加载、错误重试和空状态，按 updatedAt 降序展示本人 Markdown 文档，排除 rich、共享和显式不可查看的条目。卡片展示可选标签/摘要；仅 `canDelete: true` 提供删除，确认成功后移除，失败可重试。P0 不显示 Shared with me。

现有搜索只是**已加载列表的本地标题筛选**：支持中英文、忽略大小写、`?q=` 和 Escape 清空。A7/C6 的正文/标签全文搜索、防抖与高亮摘要未实现。模板区在加载/失败时仍可用；选择器有 Escape、Tab 和焦点归还，375px 可操作。

| 分类 | 模板 | 正文内容 |
|---|---|---|
| Blank | Blank Markdown | 空字符串 |
| Business | Meeting Notes | 会议信息、议程、讨论、决策、行动项表格 |
| Business | Weekly Report | 周总结、已完成事项、指标、问题和下周计划 |
| Personal | Reading Notes | 书籍信息、观点、引用、感想和下一步 |
| Personal | Daily Journal | 日期、心情、亮点、感恩、反思和明日计划 |
| Education | Study Notes | 目标、概念、代码示例、问题和复习 |
| Creative | Blog Draft | 读者、开篇、论点、要点、参考链接和发布清单 |

模板结构为 id/name/description/category/accent/markdown/preview。markdown 是提交的完整源码；preview 是独立缩略文本，通过 React 文本节点展示，不执行 HTML，不使用富文本 JSON 或向 Yjs 写入。

### 接口开关

`VITE_MARKDOWN_API_ENABLED` 当前默认开启；未设置也开启。显式 false 时只关闭 Markdown 主页的列表/创建/删除，仍可浏览模板，最终 Create 禁用。直接文档路由的元数据和正文读取不由此开关管理。

该开关曾在旧后端会忽略 Markdown 创建字段时默认关闭，A1/A2/A3 联调后改为开启。若连接旧后端应显式关闭；创建响应缺少正确类型时前端报错不跳转，但不能撤回旧服务端已经插入的数据。

<a id="data-model"></a>

## 4. A1：数据模型、索引及可选迁移

`DocumentDoc` 增加可选 editorType、tags、markdown、searchText、outgoingLinks、markdownIndexedAt、revision；OutgoingLink 含 title、可选 label 和可空 targetDocId。Markdown 正文是 P0 的权威数据，CRDT 状态保持为空。

客户端保留可选元数据兼容性，并提供 MarkdownDocumentPayload、MarkdownSaveStatus、SearchResult 等类型。旧文档序列化缺省为 rich、空标签及 revision 0，不需要先迁移。

启动时幂等确保以下索引，不使用 MongoDB text 索引：

```text
{ editorType: 1, updatedAt: -1 }
{ ownerUserId: 1, editorType: 1, updatedAt: -1 }
{ tags: 1 }
{ 'outgoingLinks.targetDocId': 1 }
```

可选脚本 `server/src/scripts/migrate-markdown-fields.ts` 只给缺失字段补 rich、[]、0，保留现有标签、修订号、正文、CRDT 和时间戳；重复执行不再修改。测试验证了幂等及数据保留，未对开发库运行迁移。

确需执行时，在确认进程环境 MONGO_URI / DB_NAME 后，于 server 目录运行 `npm run migrate:markdown`。脚本与服务器同样读取进程环境，未设置时使用 `mongodb://localhost:27017` 和 `nexadoc`；单独复制环境模板不等于进程已载入配置。

<a id="metadata-api"></a>

## 5. A2/A3：创建、列表、元数据与 P0 权限

```http
POST /api/documents
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "会议纪要",
  "editorType": "markdown",
  "markdown": "# Meeting notes\n\n- [ ] Follow up\n",
  "tags": ["#工作", "工作", " Notes "]
}
```

创建时：

- editorType 缺省 rich，无效类型返回 400；名称必须为字符串，trim 后为空则 `Untitled Document`；ID 使用原有 ASCII 安全规则。
- Markdown 缺省空字符串，非字符串返回 400；按 UTF-8 限制 2 MiB（2,097,152 字节），超限 400；文档路径的 JSON 接收上限为 3 MiB，包裹过大的请求仍可能由解析器拒绝。
- 原始正文包括中文、CRLF/LF、表格和任务列表完整保留，不 trim 或转格式。
- 标签去开头 #、合并空白、忽略大小写去重，最多 20 个、每个最长 30 字符；无效条目丢弃，非数组视为空标签。
- 服务器初始化 revision 0，忽略客户端修订号；crdtState 为空，大小/更新计数为 0，不创建共享记录。
- 创建时用 initialSearchText 生成最多 500,000 字符的基础文本，outgoingLinks 初始为 []，记录索引时间；完整出链在正文保存时刷新。
- rich 继续原路径，不保存请求中的 Markdown 正文。

响应只含元数据和能力，不返回正文：id/name/editorType/tags/revision/createdAt/updatedAt/abilities。

| 请求 | 行为 |
|---|---|
| `GET /api/documents` 或 `?type=all` | 本人两类文档与原有共享富文本文档 |
| `GET /api/documents?type=rich` | 富文本及缺少类型的历史文档、原有共享文档 |
| `GET /api/documents?type=markdown` | 仅本人 Markdown 文档 |
| `GET /api/documents/:id/metadata` | 元数据、类型、标签、修订号和能力 |

列表排除软删除记录，合并后按更新时间降序；无效、重复或结构化 type 返回 400。数据库投影及序列化不返回 Markdown 正文、文本索引、出链或 CRDT。客户端与服务端类型过滤共同防止两个主页混入对方的文档。

P0 权限：

- 未登录 API 返回 401；已登录非 owner 的 Markdown 文档访问返回 404，旧邀请/管理员记录不能放行。
- owner 可查看、改元数据标题和删除；canShare/canComment/canViewHistory 为 false。
- 统一文档入口限制也覆盖旧的分享/访问列表、评论、快照和富文本预览接口，owner 调用这些未开放功能返回 403；仅改 resolveAccess 不足以保护绕过该函数的旧路由。
- Markdown Yjs 升级请求：owner 403，非 owner 404；原有富文本连接继续正常。
- 当前没有完整 P2 放行；不能只把分享/协作开关设为 true 就认为功能已实现。

A4 尚未实现 PATCH 标签替换；已有 normalizeTags 和创建时标签处理不等于标签更新功能。

<a id="body-api"></a>

## 6. A5/A6：正文读写、原子修订和保存索引

```http
GET /api/documents/:docId/markdown
```

返回 markdown、revision、updatedAt。

```http
PUT /api/documents/:docId/markdown
Content-Type: application/json

{ "markdown": "# 修改后的正文\n", "baseRevision": 0 }
```

保存成功返回新 revision 和 updatedAt。接口要求 Markdown owner；rich、软删除或不可访问文档返回 404。正文为字符串且不超过 2 MiB；baseRevision 必须是合法非负安全整数。

更新原子匹配 docId、owner、类型、删除状态和 revision；缺少旧 revision 时按 0 兼容。版本不匹配返回 409 与服务器当前正文/版本/时间，不覆盖内容。两位同版本写入者只能一位成功。正文保存不改标题、标签或 CRDT。CORS 已允许 PUT。

analyzeMarkdown 为无 ESM 依赖的 TypeScript 分析：生成基础纯文本、提取并去重双链、拆分显示文字；排除围栏/行内代码、缩进代码和转义示例，支持中英文、CRLF/LF、未闭合语法及不同长度代码分隔符。索引最多 500,000 字符。

resolveLinkTargets 在本人未删除 Markdown 中按标题批量查找，唯一标题写 targetDocId，重名、未知、其他账户目标保留 null。该逻辑已服务于保存路径；A8 的 links API、反链查询、改名/未解析回填等仍需实施。

预留 MARKDOWN_COLLAB_ENABLED=true 时 PUT 返回 `409 Collaboration enabled`；此响应不当作携带当前正文的常规冲突，也不意味着当前已开放协作。

<a id="source-editor"></a>

## 7. B1/B2/B3/B8：源码、会话和安全预览

### 7.1 CodeMirror 源码

MarkdownSource 创建独立 EditorView，不使用受控 textarea。CodeMirror 管理输入/选择/历史；变化交给会话，外部恢复/加载最新再同步回来，不产生重复更新。

basicSetup、Markdown 语言及 language-data 提供行号、语法高亮、搜索、撤销和按需代码语言。额外支持 Ctrl/Cmd+S。只读同时配置 EditorState.readOnly 与 EditorView.editable，并通过 Compartment 更新，不重建历史。卸载清理订阅、组合输入定时器和 EditorView。

<a id="session"></a>

### 7.2 会话及自动保存

MarkdownSession 接口隔离源码/预览与 P0/P2 实现；LocalMarkdownSession 提供正文订阅、保存状态、update/saveNow/destroy。用户连续输入结束 800ms 后保存，手动 Save now 或 Ctrl/Cmd+S 立即尝试。

写请求串行：旧请求完成后使用其新 revision 保存最新内容。旧成功不会清除更新的草稿，也能处理“保存过程中撤销回旧原文”。状态含 idle/saving/saved/offline/conflict；网络失败保留正文，online 后重试，权限/身份失效停止写入，401 退出登录。

中文 compositionstart 暂停正文保存，compositionend 等待提交文本被消费后再开始计时，避免将候选拼音保存为最终正文。

本地草稿键名：

```text
md_draft:<编码后的用户ID>:<编码后的文档ID>
```

草稿含 markdown/revision/savedAt，300ms 节流。增加用户命名空间防止切换账户串读。保存成功仅删除与已保存正文匹配的草稿。

打开时，相同正文的重复草稿会清理；不同正文先提示 Recover draft / Use server version，选择前源码只读。恢复后版本不同则进入冲突流程。旧时间戳/旧版本的不同草稿仍允许检查，不因时钟差或中断响应而静默丢失。配额/存储异常不阻止服务器保存，但会提示本地草稿不可用。

切后台先写草稿，再发正常保存；离开页面或卸载先同步写最新草稿，JSON 保存体小于 60,000 字节时尝试 keepalive。大正文或大量转义导致包裹超限时保留本地草稿，不依赖大请求退出补存。退出登录后不会用新账户的 token 写旧会话。

409 时暂停保存并显示 Save conflict：

- Load latest 重新 GET 最新正文后替换显示。
- Keep mine and overwrite 保留当前源码，用返回的 revision 再做条件保存；若再次更新，仍会冲突，不能无条件覆盖。
- Review my source / Escape 暂时关弹窗，仍暂停保存，可再次 Resolve conflict。

弹窗有焦点约束与归还，用户明确选择前保留自己的原文。

<a id="preview"></a>

### 7.3 实时预览及双链

react-markdown + remark-gfm 支持标题、强调、列表、引用、代码、表格、任务、删除线和链接。80ms 防抖、deferred value、memo 与稳定渲染器减少预览对输入的干扰；空正文有占位，渲染错误边界不移除源码。

不引入 rehype-raw，skipHtml 忽略原始 HTML，保留默认 URL 过滤；外部 HTTP(S) 链接新标签打开并设 noopener noreferrer，代码作为文本，图片地址经过过滤。

remarkWikiLink 只转换普通文本中的 `[[标题]]` / `[[标题|显示]]`，不转换代码、原有 Markdown 链接和转义示例。本人列表中唯一标题直接跳文档；未知/重名标题跳主页标题筛选。B6 补全和 C8 反链面板不包含在这里。

当前布局是基础桌面双栏、手机上下排列。B4 的三态、同步滚动与完整状态栏仍未完成；B5 格式按钮和 B7 标签/标题编辑也未完成。B8 的 P0 守卫/保存状态/只读准备已有，P2 共享 reader 的真实协作限制另验收。

## 8. 代码位置与依赖

路径相对于项目根目录。

| 路径 | 职责 |
|---|---|
| `client/src/components/AppMenu.tsx` | 全局菜单和键盘操作 |
| `client/src/App.tsx`、`client/src/components/DocumentTypeGuard.tsx` | 登录保护、懒加载和类型纠正 |
| `client/src/components/shared/DocumentCard.tsx`、`CreateDocModal.tsx` | 公共卡片与命名 UI |
| `client/src/components/DocsPage.tsx`、`Editor.tsx` | 富文本复用及兼容 |
| `client/src/components/markdown/MarkdownHome.tsx` | Markdown 主页状态、请求及导航 |
| `client/src/components/markdown/MarkdownTemplateGallery.tsx`、`MarkdownTemplatePicker.tsx`、`MarkdownTemplatePreview.tsx` | 模板分类、选择和安全缩略图 |
| `client/src/templates/markdown/` | 七个模板和注册表 |
| `client/src/components/markdown/MarkdownEditor.tsx` | 正文加载、会话生命周期、恢复与冲突 UI |
| `client/src/components/markdown/MarkdownSource.tsx`、`MarkdownPreview.tsx` | CodeMirror 与实时渲染 |
| `client/src/markdown/remarkWikiLink.ts`、`contentApi.ts` | 双链插件、正文传输及结构化冲突 |
| `client/src/markdown/session/` | 会话接口、本地保存及草稿 |
| `client/src/services/api.ts`、`markdownDocuments.ts` | API 类型、主页适配和接口开关 |
| `client/src/types/index.ts`、`client/src/index.css` | 公共类型及样式 |
| `server/src/types.ts`、`db.ts` | 模型和幂等索引 |
| `server/src/scripts/migrate-markdown-fields.ts` | 可选补字段迁移 |
| `server/src/routes/documents.ts`、`markdown.ts` | 创建/列表/元数据和正文接口 |
| `server/src/markdown/metadata.ts`、`server/src/markdown/restrictRoutes.ts`、`server/src/rbac.ts` | 标签/序列化和 P0 权限 |
| `server/src/markdown/initialSearchText.ts`、`analyze.ts`、`resolveLinkTargets.ts` | 初始文本、保存分析与目标解析 |
| `client/e2e/shared-components.spec.ts`、`workspace-navigation.spec.ts` | 卡片、菜单及路由回归 |
| `client/e2e-markdown/markdown-home.spec.ts` | 模板和主页模拟接口验证 |
| `client/e2e-markdown-live/` | 真实接口、数据库和编辑器联调 |
| `client/playwright.markdown.config.ts`、`playwright.markdown-live.config.ts` | 两类浏览器验证配置 |
| `server/scripts/markdown-e2e-server.cjs` | 临时数据库及真实测试服务 |

各实现目录的 `.test.ts/.test.tsx` 覆盖公共组件、主页、API、会话、预览、迁移、解析和路由。client/vitest.config.ts 排除全部 e2e*/ 目录，避免混收 Playwright。

客户端已安装 CodeMirror 及语言包、react-markdown、remark-gfm、unified、remark-parse，package-lock.json 已记录。P0 不安装 y-codemirror.next；服务端分析使用纯 TypeScript，不导入 ESM-only Markdown 包。

最终已记录的主脚本 gzip 约 640.98 kB；MarkdownEditor 懒加载包约 817 kB / gzip 272 kB，代码语言另行按需加载。Vite 有超过 500 kB chunk 的提示，完整包体优化仍待后续。

<a id="tests"></a>

## 9. 测试证据、历史记录与限制

### 当前最近一次功能验证

| 检查 | 已有结果 |
|---|---|
| 前端类型检查及生产构建 | 通过 |
| 前端单元/集成 | 20 个文件、210 项通过 |
| 服务端类型检查及生产构建 | 通过 |
| 服务端测试 | 14 个文件、205 项通过 |
| 真实 Express / MongoDB / Edge | 17 项通过，42.4 秒 |
| 模拟接口主页/菜单/路由回归 | 24 项通过，41.0 秒 |

以上是功能实现时的验证结果，不把本次计划/文档整理当作重新运行代码测试。当前测试覆盖仍不足以将 A10、B9、C12、C13 整项标为完成，未实现功能必须补齐后再验收。

<a id="history"></a>

### 历史验证归档

| 历史阶段 | 当时记录 | 适用边界 |
|---|---|---|
| C3 前基线 | 前端 111 项、类型检查通过 | 公共组件抽取前 |
| C3 | 12 文件、127 项；新增 16；类型/构建及浏览器 6 项通过 | 公共组件及富文本回归 |
| C1/C2 初次 | 14 文件、150 项；类型/构建及浏览器 15 项通过 | 菜单快捷项修订前 |
| 菜单修订 | 删除两项旧快捷导航用例，前端 148 项；重跑相关桌面/手机浏览器 2 项通过 | 菜单不再提供新建和搜索 |
| C4/C5 | 前端 176 项场景、浏览器 24 项通过 | 当时后端未接入，主页开关关闭；后续修复 Vitest 新目录排除 |
| A1/A2/A3 | 服务端 173 项（新增 53），前端 177 项；真实浏览器 5 项，模拟回归 24 项通过 | 模型、创建、列表及真实模板落库；当时编辑器还是骨架 |
| B1/B2/B3 及必要接口 | 前端 210 项（新增 33），服务端 205 项（新增 32）；真实 17、模拟 24 项通过 | 当前基础编辑闭环；其余 P0/P2 功能未齐 |

历史主包 gzip：C3 约 637.75 kB，菜单修订后约 640.53 kB；这些是当时产物数据，不作为当前包体重新测量。

新增验证包括主页 13、模板 9、主页 API 初始 6 项；A 阶段接口 45、标签/文本 6、索引/迁移 2 项；B 阶段会话 20、正文传输 5、预览 8，服务端正文接口 23、分析 9 项。不同轮次增量/总数按该轮记录解释，不混加为本轮新增。

真实浏览器覆盖模板精确落库、富文本/旧文档分流、软删除、非 owner 拒绝和 Markdown Yjs 拒绝；新增编辑验证覆盖源码/GFM、刷新保留、Ctrl+S/撤销、草稿恢复/放弃、双窗口冲突/覆盖/加载最新、退出补存、5,000 行虚拟视图编辑、双链、HTML 惰性、安全加载重试和 375px。

中文组合输入使用 Chromium CDP 模拟提交前后事件，不能替代所有操作系统输入法的人工验收。当前浏览器覆盖是本机 Edge，其他浏览器、完整性能和可访问性仍待 B9/C13。

历史排障结论：模拟浏览器曾被 Google 字体请求拖超时，测试夹具已隔离字体请求并在截图时关闭动画；MongoDB 测试首次在沙箱中启动失败，随后在获准环境使用临时库通过；Playwright 目录曾被 Vitest 误收集，已修复排除；小文档刷新前可能 keepalive 成功补存，草稿恢复测试改用确实未落库的大草稿后通过。没有通过放宽功能断言掩盖失败。

## 10. 使用、配置和验证命令

其他成员同步代码后，在 client 执行 `npm ci` 安装锁定依赖。MongoDB 可用且环境正确后，在 server/client 分别运行 `npm run dev`。本次未改变原有进程环境读取方式。

```dotenv
VITE_MARKDOWN_API_ENABLED=true
```

若已有客户端环境文件设为 false，改为 true 并重启 Vite；生产部署需重建。主页接口默认开启，但正式新功能仍以串行任务表为准。

登录后通过 `☰ → Markdown`，新建模板或打开文档，编辑源码并观察预览；停止输入约 800ms 后观察 Saved，刷新继续编辑。网络中断后保留浏览器存储，有草稿时按恢复提示选择；冲突时明确选择保留哪个版本。

```powershell
# server 目录
npm.cmd run typecheck
npm.cmd run build
npm.cmd test

# client 目录
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright test --config playwright.markdown-live.config.ts
npx.cmd playwright test --config playwright.markdown.config.ts
```

真实浏览器配置构建前后端，在 3018 运行独立临时服务，覆盖开发库连接并使用 e2e_markdown_isolated；测试可直接查询该临时 MongoDB 核对源码。模拟回归在 5186/5187 测试接口开关开启/关闭，不覆盖普通 dist、不连接开发库。结果位于忽略提交的 playwright-report/、test-results/。默认 Edge，可通过 PLAYWRIGHT_CHANNEL 指定其他已安装频道。

## 11. 后续实施边界

下一项功能补齐为 B4；其他待办和前置资料确认统一遵循计划第 12 节。现有 normalizeTags 不等于 A4 PATCH，正文解析/目标解析不等于 A8 API，标题筛选不等于全文检索，基础冲突弹窗不等于 B7 全部完成，已有测试数量超过最初目标也不等于已覆盖剩余产品范围。

参考：[CodeMirror 基础编辑器](https://codemirror.net/examples/basic/)、[动态配置](https://codemirror.net/examples/config/)、[react-markdown API 与安全说明](https://github.com/remarkjs/react-markdown)。
