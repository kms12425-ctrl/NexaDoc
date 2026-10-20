# A1/A2/A3 实施与测试记录

更新日期：2026-10-20。

> 后续进展：B1/B2/B3 已完成，并补齐必要的正文 GET/PUT、修订冲突及保存分析逻辑。下文“编辑器骨架”“A5/B 待实现”和测试数量保留为 A1/A2/A3 当时的记录；最新功能、使用方式和测试结果见 [B1/B2/B3 实施与测试记录](./B1_B2_B3_IMPLEMENTATION_NOTES.md)。

## 1. 已完成的任务

| 任务 | 完成内容 |
|---|---|
| A1：模型、索引、迁移 | 服务端 EditorType/OutgoingLink/Markdown 字段；客户端正文载荷、保存状态及搜索结果类型；4 个幂等索引；可选幂等补字段脚本 |
| A2：创建文档 | 支持 Markdown 完整源码、标签规范化、初始 revision；默认 rich 兼容；类型与大小检查；初始化空 CRDT 状态和基础文本索引 |
| A3：列表与元数据 | rich/markdown/all 过滤；旧数据缺省 rich；返回 editorType/tags/revision；Markdown 仅 owner 可见；不返回正文或索引载荷 |
| C4/C5 联调 | 启用真实主页数据操作，DocsPage 显式请求 rich；真实浏览器创建 7 个模板并逐一核对 MongoDB 源码、刷新列表和类型路由 |

Markdown 主页现在可以真实新建、列出、按标题筛选和软删除文档。创建成功后进入已有 Markdown 编辑页骨架，页面显示标题；**正文输入、读取、自动保存和实时预览仍需 A5/B 实现**。

本次未执行开发数据库迁移，没有改写用户已有文档。所有数据库测试使用临时 MongoDB，真实浏览器联调也使用独立服务器和测试数据库。

## 2. A1：数据模型、索引及迁移

`DocumentDoc` 新增可选字段：

- `editorType: 'rich' | 'markdown'`，旧数据缺省为 rich。
- `tags`、`markdown`、`searchText`、`outgoingLinks`、`markdownIndexedAt`、`revision`。
- `OutgoingLink` 预留标题、显示文字及 `targetDocId`。

客户端保留可选元数据兼容性，并增加 `MarkdownDocumentPayload`、`MarkdownSaveStatus`、`SearchResult` 类型，供后续 A5/B/C 使用。

数据库连接时幂等创建以下索引：

```text
{ editorType: 1, updatedAt: -1 }
{ ownerUserId: 1, editorType: 1, updatedAt: -1 }
{ tags: 1 }
{ 'outgoingLinks.targetDocId': 1 }
```

不建立 text 索引，不要求先迁移历史记录。`type=rich` 使用 `$ne: 'markdown'`，包含未设置类型的旧文档；序列化时为缺少的字段返回 `editorType: 'rich'`、`tags: []`、`revision: 0`。

可选脚本：`server/src/scripts/migrate-markdown-fields.ts`。仅为缺失字段补值，保留已有标签、修订号、正文、CRDT 数据和时间戳。重复执行不产生额外修改。

如确需迁移，在确认进程使用的 `MONGO_URI`、`DB_NAME` 后，于 `server` 目录执行：

```powershell
npm.cmd run migrate:markdown
```

脚本与服务器使用同样的环境变量读取方式；未设置时使用本机 `mongodb://localhost:27017`、数据库 `nexadoc`。本次只在测试库验证迁移函数，未对开发库运行此命令。

## 3. A2：创建接口

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

创建行为：

- 未提供 `editorType` 时为 rich；无效类型返回 400。
- Markdown 正文缺省为空字符串；显式提供非字符串时返回 400。
- 按 UTF-8 字节检查正文，最大 2 MiB（2,097,152 字节），超限返回 400。文档路由的 JSON 接收上限为 3 MiB，容纳正文及 JSON 包装；极大的请求体仍会由解析器拒绝。
- 完整保留正文，包括中文、换行、表格和任务列表，不 trim 或转换正文。
- 名称 trim 后为空则使用 `Untitled Document`；非字符串名称返回 400。文档 ID 继续使用现有 ASCII 安全生成规则。
- 标签去掉开头 `#`、合并空白、忽略大小写去重，单个最长 30 字符、最多 20 个。无效条目丢弃，非数组按空标签处理。
- `revision` 固定由服务器初始化为 0，忽略客户端传入的修订号。
- Markdown 的 `crdtState` 为空，`crdtStateSize/updateCount` 为 0，不创建共享记录。
- 初始化基础 `searchText`，长度最多 500,000 字符；`outgoingLinks: []`，记录 `markdownIndexedAt`。

响应包含 `id/name/editorType/tags/revision/createdAt/updatedAt/abilities`，不回传完整正文。富文本继续按原路径创建，不保存请求中的 Markdown 正文。

为满足创建时文本索引，新增无依赖的 `initialSearchText()`，处理基础标题、列表、引用、表格、链接显示文字及代码围栏。**它不是完整的 A6 双链分析器**；后续 A6/A5 需要统一保存时分析、链接提取和目标解析。

## 4. A3：列表、元数据及权限

| 请求 | 行为 |
|---|---|
| `GET /api/documents` | 等同 all，保持旧调用兼容 |
| `GET /api/documents?type=all` | 当前用户拥有的两类文档 + 获得共享的富文本文档 |
| `GET /api/documents?type=rich` | 富文本文档，包含缺失 editorType 的旧记录及原有共享文档 |
| `GET /api/documents?type=markdown` | 当前用户拥有的 Markdown 文档 |
| `GET /api/documents/:id/metadata` | 返回元数据、类型、标签、修订号及能力 |

列表排除软删除记录，统一按更新时间降序排列。无效、重复或结构化 type 参数返回 400。列表查询投影排除 CRDT、Markdown 正文、文本索引和出链信息，响应也不暴露这些字段。

Markdown P0 权限规则：

- owner 可查看、编辑元数据及删除；`canShare/canComment/canViewHistory` 为 false。
- 其他用户、匿名身份及旧邀请记录均不能获得 Markdown 访问权。非 owner 的文档请求返回 404。
- 文档路由入口统一拦截 Markdown，覆盖已有分享/访问列表、评论、快照和富文本预览接口；owner 请求这些未开放功能返回 403。
- `/yjs/:id` 不允许 Markdown 升级连接，owner 返回 403；非 owner 返回 404。富文本协作连接继续正常。
- 当前没有实现 P2 开关放行；P2 需完整实现分享/协作后再调整这些限制。

此处增加统一入口是必要的：部分既有富文本接口直接查数据库，没有经过 `resolveAccess`，仅修改元数据接口不足以落实 Markdown 的 owner-only 规则。

## 5. 前端接入及使用

`MarkdownHome` 的接口默认开启，`.env.template` 中为：

```dotenv
VITE_MARKDOWN_API_ENABLED=true
```

未设置该变量时也默认开启。连接旧版后端时可显式设置 false，保留模板浏览并关闭主页列表/创建/删除。若本机 `.env` 曾设置 false，需要改为 true，并重启 Vite；部署前端需要重新构建。

`DocsPage` 现在请求 `type=rich`，同时保留前端防御过滤；MarkdownHome 请求 `type=markdown`。两类主页不会混入对方的文档。

完成后重启后端和前端，登录并通过 `☰ → Markdown`：

1. 点击模板，输入名称并创建，进入 `/markdown/:id`。
2. 返回主页或刷新，文档仍在列表中。
3. 切换 Docs，列表只显示富文本文档。
4. 在 Markdown 主页确认删除，刷新后不再显示。

编辑页的“Markdown editing will be available soon”仍是预期状态，不能据此认定 A2 未保存内容；本次真实测试已经直接核对数据库中的完整模板源码。编辑展示与后续修改仍待 A5/B。

## 6. 测试结果及复现

| 检查 | 结果 |
|---|---|
| 服务端类型检查及构建 | 通过 |
| 服务端全量测试 | 12 个文件，173 项通过；其中本次新增 53 项 |
| 客户端类型检查 | 通过 |
| 客户端全量测试 | 17 个文件，177 项通过 |
| 真实浏览器 + Express + MongoDB | 5 项通过 |
| C1—C5 模拟接口浏览器回归 | 24 项通过（49.9 秒） |

客户端默认生产构建通过，保留既有大 chunk 警告；真实浏览器使用的前后端生产构建也通过。`git diff --check` 通过。

新增服务端测试包含 45 项接口用例、6 项标签/初始文本索引用例、2 项索引/迁移用例，覆盖：

- 原始源码落库、空白模板、UTF-8 边界、默认 rich 和错误输入不写库。
- 三种类型列表、旧文档、共享富文本、Markdown 访问隔离、软删除及排序。
- 元数据缺省值、正文不泄漏、历史 admin 邀请不越权、旧功能在 Markdown 下禁用。
- 索引重复创建、迁移重复执行、已有内容和 CRDT 数据不变。

真实浏览器用例未模拟文档 API，执行以下检查：

1. 通过主页依次创建 7 个真实模板，直接查询临时 MongoDB，逐一核对完整源码、空 CRDT 状态及初始修订号；刷新后 7 张卡片仍在。
2. Markdown/rich/未迁移旧文档在两个主页正确分流。
3. 真实软删除及刷新结果，数据库仍保留原始正文。
4. 第二账户即使有旧 admin 邀请也无法查看或删除 Markdown。
5. Markdown 的 Yjs 连接被拒绝，富文本的 Yjs 连接成功。

服务端测试首次在沙箱内无法启动 MongoDB，随后在获得执行许可的环境中运行通过。前端回归发现 `e2e-markdown` 被 Vitest 误收集，现已将全部 `e2e*/` 目录归入 Playwright，177 项单元/集成测试重新完整通过。

PowerShell 复现：

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

真实浏览器配置会构建前端和服务端，启动独立的临时 MongoDB 与 3018 测试服务器，覆盖开发环境传入的数据库连接，使用 `e2e_markdown_isolated` 数据库。模拟回归使用 5186/5187 两种开关构建，不连接开发库。测试默认使用本机 Edge；可通过 `PLAYWRIGHT_CHANNEL` 指定其他已安装的浏览器频道。构建、结果和追踪文件位于忽略提交的 `playwright-report/`、`test-results/`。

## 7. 后续任务边界

- **A4**：PATCH 标签替换尚未完成；本次提供的 normalizeTags 可复用。
- **A5**：正文 GET/PUT、revision 并发控制尚未完成。
- **A6**：完整双链分析、代码块/行内代码排除和目标解析仍需推进。
- **A7—A9**：全文搜索、反链、标签统计及建议接口尚未实现。
- **B1—B9**：Markdown 正文编辑、预览和自动保存仍需接入。
- A1/A2/A3 的完成解除 C4/C5 创建与列表的真实接口阻塞；未完成整个 Markdown 项目的发布验收。
