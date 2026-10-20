# C4/C5 实施与测试记录

更新日期：2026-10-20。

> 后续进展（2026-10-20）：A1/A2/A3 已完成，主页数据接口默认开启；B1/B2/B3 随后已接入正文编辑、预览和自动保存。下文保留 C4/C5 初次交付时的状态和测试数量，其中“等待 A2/A3”“默认关闭接口”“编辑器骨架”等描述已被替代。接口基础见 [A1/A2/A3 记录](./A1_A2_A3_IMPLEMENTATION_NOTES.md)，最新编辑功能与测试结果见 [B1/B2/B3 记录](./B1_B2_B3_IMPLEMENTATION_NOTES.md)。

## 1. 交付状态

| 任务 | 已实现 | 尚待联调 |
|---|---|---|
| C4：MarkdownHome | 与 DocsPage 共用顶部栏、模板区、文档卡片、命名弹窗及样式；列表、加载/错误/空状态、创建跳转、删除、标题筛选 | A1/A2/A3 完成后验证真实文档创建、持久化、类型过滤和元数据；目前通过模拟接口测试 |
| C5：7 个 Markdown 模板 | 5 类、7 个模板的独立源码、缩略图、分类切换、选择器；创建请求传入所选模板完整源码 | 数据落库后读取源码的最终验收依赖 A2/A5；编辑器内显示与刷新保留依赖 B 的编辑/保存工作 |

本次完成 C4/C5 的前端实现和可独立验证的测试。整体任务的真实后端验收仍未完成，不能将模拟接口结果视为 MongoDB 持久化验证。

当前服务端的 `POST /api/documents` 仅处理名称，忽略 `editorType/markdown/tags`；列表和元数据也尚未返回 Markdown 类型。因此新增 `VITE_MARKDOWN_API_ENABLED` 开关，默认关闭 Markdown 主页的列表、创建及删除请求，防止误向旧接口创建富文本文档。默认可浏览分类、模板和命名弹窗，最终 Create 按钮禁用并给出说明；没有运行时假文档或模拟成功提示。

该开关只保护 Markdown 主页的数据操作。直接访问 `/markdown/:id` 时，C2 类型守卫仍会请求元数据；旧数据缺少 `editorType` 时继续按 rich 处理。

## 2. 页面及交互

- 顶部保留 NexaDoc 品牌、工作区菜单、用户信息、退出、标题搜索和 New document。新建及搜索只在主页提供，汉堡菜单继续只做工作区切换和通用入口。
- 模板区支持 Blank、Business、Personal、Education、Creative 五类；New document 打开包含 All 的完整模板选择器。
- 点击模板后进入公共命名弹窗；名称去除首尾空白。空白模板未命名时使用 `Untitled document`，其他模板使用模板名称。
- 开启接口后，创建成功跳转 `/markdown/:id`。请求期间禁止重复提交与关闭弹窗；失败保留名称、所选模板和错误提示，可以重试。
- 列表请求 `GET /api/documents?type=markdown`，前端再排除 rich、共享、显式不可查看的条目，按 `updatedAt` 降序展示。前端过滤属于展示防御，服务端仍须执行 owner-only 权限控制。
- 文档卡片复用 `DocumentCard`，显示名称、更新时间和可选标签/摘要。没有 `Shared with me` 区域；仅 `canDelete: true` 的文档提供删除按钮，确认成功后移除卡片，失败可重试。
- 标题筛选支持中英文、忽略大小写、URL `?q=` 状态及 Escape 清空。这只是已加载列表的本地标题过滤；C6 的服务端全文检索、防抖、摘要高亮及标签过滤尚未实现。
- 模板选择器支持 Escape、Tab 焦点约束及取消后的焦点归还。375px 下顶部操作分行，模板区可横向滚动，选择器可纵向滚动。

## 3. 模板清单

| 分类 | 模板 | 主要内容 |
|---|---|---|
| Blank | Blank Markdown | 正文为空字符串 |
| Business | Meeting Notes | 会议信息、议程、讨论、决策、行动项表格 |
| Business | Weekly Report | 周总结、已完成事项、指标、问题、下周计划 |
| Personal | Reading Notes | 书籍信息、主要观点、引用、感想与下一步 |
| Personal | Daily Journal | 日期、心情、亮点、感恩、反思及明日计划 |
| Education | Study Notes | 学习目标、概念、代码示例、问题与复习 |
| Creative | Blog Draft | 目标读者、开篇、论点、要点、参考链接及发布清单 |

每个模板包含 `id/name/description/category/accent/markdown/preview`。`markdown` 是实际提交的原始源码，`preview` 是缩略图用的独立文本。缩略图通过 React 文本节点展示，不执行 HTML；不使用富文本 JSON，也不向 Yjs 写入模板。页面内的大型 Markdown 渲染预览仍属于 B 的编辑器任务。

## 4. 代码位置

路径相对于项目根目录。

| 路径 | 用途 |
|---|---|
| `client/src/components/markdown/MarkdownHome.tsx` | 主页、状态、请求和导航 |
| `client/src/components/markdown/MarkdownTemplateGallery.tsx` | 主页分类与模板卡片 |
| `client/src/components/markdown/MarkdownTemplatePicker.tsx` | 完整模板选择器 |
| `client/src/components/markdown/MarkdownTemplatePreview.tsx` | 安全文本缩略图 |
| `client/src/templates/markdown/` | 类型、7 个模板及分类注册表 |
| `client/src/services/markdownDocuments.ts` | 开关、Markdown API 适配及类型防御 |
| `client/src/services/api.ts` | 向后兼容的可选列表类型及 Markdown 创建参数 |
| `client/src/components/shared/CreateDocModal.tsx` | 可选提交中、禁用及错误状态；原 DocsPage 调用方式保持兼容 |
| `client/src/types/index.ts` | 可选 tags/revision/snippet 字段 |
| `client/src/index.css` | 模板预览、提示、弹窗和 Markdown 移动布局 |
| `client/.env.template` | 默认关闭的接口开关说明 |
| `client/src/components/markdown/MarkdownHome.test.tsx` | 主页集成测试 |
| `client/src/services/markdownDocuments.test.ts` | API 契约及开关测试 |
| `client/src/templates/markdown/index.test.ts` | 模板数据测试 |
| `client/e2e-markdown/markdown-home.spec.ts` | 9 个 C4/C5 浏览器用例 |
| `client/playwright.markdown.config.ts` | 隔离的双开关构建与 24 项浏览器回归配置 |

没有添加依赖，没有改动服务端接口或 MongoDB，也未实现 B 的编辑器内核。`MarkdownEditor` 仍为已有骨架。

## 5. 与 A/B 的接口约定

创建请求示例：

```http
POST /api/documents
Content-Type: application/json

{
  "name": "会议纪要",
  "editorType": "markdown",
  "markdown": "# Meeting notes\n\n...",
  "tags": []
}
```

A2 需要落库完整源码、类型、标签及初始 `revision: 0`，返回文档元数据。前端检查创建响应的 `editorType === 'markdown'`；缺少或错误类型会保留命名弹窗并提示服务器不支持，不跳入错误的编辑器。此响应检查不能撤回旧服务端已经创建的数据，因此应在 A2/A3 完成前保持开关关闭。

A3 需要支持 `type=markdown` 过滤，并让列表及 `GET /api/documents/:id/metadata` 返回 `editorType`、`tags`、`revision` 和能力信息。`snippet` 为可选，缺少时卡片依然可用。前端现有 `documentsApi.list()` 和 `create(name)` 的富文本调用保持原行为。

A5/B 就绪后，编辑器应从服务端读取创建时存储的源码。主页只负责提交模板与跳转，不借助路由 state 临时保存正文。

## 6. 测试结果与复现

| 检查 | 结果 | 范围 |
|---|---|---|
| `npm.cmd run typecheck` | 通过 | 客户端源码及单元测试类型检查 |
| `npm.cmd test` | 17 个文件、176 项通过 | 既有 148 项 + 新增 28 项；包含模板 9、API 6、主页 13 项 |
| `npm.cmd run build` | 通过 | 默认关闭接口的生产构建；仍有既有大 chunk 提示 |
| C4/C5 浏览器测试 | 9 项通过 | 7 模板源码逐一核对、创建/跳转、失败与重复提交、分类/键盘、列表重试、删除、中文标题筛选、375px、默认开关关闭 |
| C1/C2/C3 浏览器回归 | 15 项通过 | 菜单、登录保护、懒加载、类型守卫、富文本卡片/创建/删除/焦点交互 |

最终使用专用配置完整执行，24 项浏览器测试一次全部通过（48.6 秒），包含两种接口开关状态的生产构建。`git diff --check` 通过。

浏览器使用本机 Edge，API 和身份信息由测试夹具隔离，不写入用户数据库。新增浏览器文件放在 `e2e-markdown/`，由专用配置运行；普通后端 e2e 套件不需要开启 Markdown 接口。专用配置也会运行 `e2e/` 中两个已有回归文件。

PowerShell 在 `client` 目录执行：

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright test --config playwright.markdown.config.ts
```

浏览器配置分别以 `VITE_MARKDOWN_API_ENABLED=true/false` 构建两个隔离目录，在 5186/5187 端口预览；不覆盖正常的 `dist/`，不需要真实服务器或 MongoDB。结果保存在忽略提交的 `playwright-report/c4-c5/` 与 `test-results/c4-c5-browser/`。可用 `PLAYWRIGHT_CHANNEL` 指定本机安装的其他 Playwright 浏览器频道，默认 `msedge`。

首次浏览器运行有两项因 Google 字体网络加载超时失败；追踪确认是外部字体等待。模拟测试现已拦截字体请求，使用本地后备字体，截图关闭动画后重新验证。未通过延长断言等待来掩盖功能失败。

## 7. 使用与后续验收

当前启动客户端并登录后，通过 `☰ → Markdown` 进入主页，浏览五类模板，点击模板查看命名弹窗。默认看到后端功能尚未开放的提示，Create 禁用；这是等待接口接入的明确状态。

A1/A2/A3 完成并通过服务端测试后，在客户端 `.env` 中设置：

```dotenv
VITE_MARKDOWN_API_ENABLED=true
```

重启 Vite；生产环境需重新构建。随后进行真实联调：

1. 新建空白与 6 个非空模板，确认数据库 `editorType/markdown/tags/revision` 正确。
2. 刷新主页，确认只显示当前用户的 Markdown 文档，rich 和共享文档不混入。
3. 检查新建后的 `/markdown/:id` 类型守卫通过，不错误转到富文本编辑器。
4. A5/B 完成后，确认编辑器显示模板完整内容，修改并刷新仍保留。
5. 使用第二账户测试 owner-only 边界，并验证真实删除及刷新后结果。

完成这些检查后再将 C4/C5 的端到端验收标为完成。后续 C6/C7/C8 继续等待各自 A 侧接口；本次没有提前宣称完成全文检索、标签编辑、双链或导出。
