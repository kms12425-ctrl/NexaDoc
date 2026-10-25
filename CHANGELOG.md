# Changelog

本文件记录各阶段可感知的功能变更。阶段一/二的发布说明见 `docs/阶段一/PHASE1_CHANGELOG.md`。

## [阶段四] Markdown 编辑器（P0）— 2026-10-25

### 新增

- **Markdown 工作区**：汉堡菜单切换 `Docs / Markdown`；`/markdown` 同构主页、五类七个模板、「我的文档」网格、搜索框、空状态与错误状态。
- **编辑与预览**：CodeMirror 源码编辑器（高亮、撤销、只读、IME 组合输入）、Source/Split/Preview 三态布局、滚动同步、格式工具栏与快捷键、GFM + 双链安全实时预览（不执行原始 HTML）。
- **自动保存**：800ms 防抖保存、300ms 草稿节流、离线/退出 flush、revision 冲突提示、草稿恢复。
- **标签**：编辑器增删标签、主页标签筛选与计数、服务端规范化（去 `#`、去重、30 字符 / 20 个上限）。
- **全文搜索**：标题/正文/标签匹配、多词 AND、相关性排序、摘要与高亮、owner-only。
- **双链与反链**：`[[标题]]` / `[[标题|显示]]` 解析与自动补全、出链/反链面板、改名后链接仍有效。
- **导出**：`.md` / `.html` / `.pdf` / `.docx` 四种格式，文件名清洗，使用最新未保存源码，HTML 不执行脚本。

### 变更

- 数据模型扩展：`editorType`、`markdown`、`revision`、`tags`、`searchText`、`outgoingLinks`、`markdownIndexedAt`；缺省 `editorType` 按 `rich` 兼容。
- 列表接口支持 `type=rich|markdown|all` 过滤；Markdown 与富文本列表互斥。
- Markdown P0 为 owner-only，禁用 Share / Comments / History 及对应接口。

### 测试

- 服务端 239 项通过（A10 补齐 A4/A7/A8/A9 的 30 项用例）。
- 客户端 222 项通过（含导出模块 12 项单测）。
- 端到端：C12 新增导出 / 搜索 / 标签 / 反链全流程 10 条。

### 文档

- 用户手册：`docs/阶段四-添加makdown编辑器/MARKDOWN_USER_GUIDE.md`
- 实施与测试记录：`docs/阶段四-添加makdown编辑器/MARKDOWN_IMPLEMENTATION_NOTES.md`
- 计划与契约：`docs/阶段四-添加makdown编辑器/MARKDOWN_EDITOR_DETAILED_PLAN.md`、`M0-1`、`M0-2`、`M0-3`

---

## 发布清单（阶段四 P0）

- [x] `server` typecheck 与全量测试通过（239 项）
- [x] `client` typecheck 与全量测试通过（222 项）
- [x] 服务端新增 ≥ 30 用例（实际 30 项）
- [x] 导出四种格式下载并打开（`.md`/`.html`/`.pdf`/`.docx`）
- [x] 文件名清洗、HTML 不执行脚本、DOCX/PDF 已知降级已记录
- [x] Share / Comments / History 已隐藏；非 owner 访问 Markdown 返回 404
- [x] 用户手册、CHANGELOG 与发布清单齐备
- [ ] 端到端回归全绿（`cd client && npm run test:e2e` 及 `playwright.markdown-live.config.ts`）
- [ ] P0-G3 演示（主页模板 → 新建 → 实时预览 → 标签 → 搜索 → 双链 → 导出）
- [ ] P0 bug = 0；P1 bug 有延期记录
