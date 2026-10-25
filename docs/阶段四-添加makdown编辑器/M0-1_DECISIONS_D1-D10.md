# M0-1 产品决策记录：D1–D10 冻结

> 对应计划：`MARKDOWN_EDITOR_DETAILED_PLAN.md` 第 2 节「需要团队拍板的产品决策」
> 阶段：阶段四（Markdown 编辑器）· G0 设计冻结
> 状态：待签字
> 日期：2026-10-25
> 参与：A（后端/数据/搜索/双链 + 技术协调）、B（Markdown 编辑器内核）、C（主页/检索与双链 UI/导出/QA）

## 一、决策总表（冻结稿）

| 编号 | 决策点 | 最终拍板值 | 理由 | 代码现状 |
|------|--------|-----------|------|---------|
| D1 | 文档类型是否可切换 | **类型固定**：创建时选择 `rich`/`markdown`，之后不可原地切换 | 两种格式的 Yjs 结构不同，原地转换会丢格式；Docs/Sheets 也是不同文档类型 | ✅ `server/src/types.ts` `EditorType='rich'\|'markdown'` + `client/src/components/DocumentTypeGuard.tsx` 类型守卫，互相重定向 |
| D2 | 菜单行为 | **工作区切换**：`Docs`→`/`，`Markdown`→`/markdown`；当前类型打勾 | 与 Google Docs 一致 | ✅ `client/src/components/AppMenu.tsx` |
| D3 | Markdown 编辑布局 | **默认左右 50/50 分栏**；支持 `Source / Split / Preview` 三态 | 符合产品需求；分栏是 Typora/Obsidian 常见心智 | ✅ `MarkdownEditor.tsx` 默认 `layout='split'`，三态切换按钮 |
| D4 | Markdown 主页 | **复用 DocsPage 布局与 CSS**（header、模板区、最近文档网格、搜索、空状态） | 降低学习成本、视觉统一；只替换模板/卡片内容 | ✅ `MarkdownHome.tsx` + 共享组件 `shared/DocumentCard.tsx`、`shared/CreateDocModal.tsx` |
| D5 | 分享 | **P0 不做，P2 做**；P0 隐藏 Share 按钮，Markdown 文档仅 owner 可访问 | 避免半成品分享造成权限漏洞 | ✅ `server/src/markdown/restrictRoutes.ts` 对 `/share\|access` 返回 403；`server/src/server.ts` 对 Markdown 的 `/yjs` 返回「Markdown Collaboration Unavailable」 |
| D6 | 多人实时编辑 | **P0 不做，P2 做**；P0 单用户自动保存 | 降低首版复杂度；P2 经 `MarkdownSession` 接口无缝升级 | ✅ 仅有 `LocalMarkdownSession`，无 `CollabMarkdownSession` |
| D7 | 搜索范围 | **P0 只搜自己的 Markdown 文档** | 与 P0 owner-only 权限一致 | ✅ `routes/search.ts`、`routes/tags.ts`、`routes/documents.ts`（suggest）均按 `ownerUserId` 过滤 |
| D8 | 标签规则 | 每篇 ≤20；每个 1–30 字符；去开头 `#`；大小写不敏感去重；owner 可改 | 防止标签爆炸 | ✅ `server/src/markdown/metadata.ts` `normalizeTags()` |
| D9 | 导出格式 | `.md` / `.html` / `.pdf` / `.docx` | 覆盖存档/网页/打印/交作业 | ⚠️ 决策已冻结，但**实现缺失**（见下方偏差项） |
| D10 | UI 文案 | 沿用英文 UI（`Docs`/`Markdown`/`Saved`/`Add tag`…） | 与现有产品一致 | ✅ 界面文案全英文 |

## 二、冻结时需要留意的偏差项

- **D9 实现缺口**：四种导出（R8 / C9–C11）的**实现**（`client/src/markdown/export/` 目录 + `ExportMenu.tsx` 组件）在当前代码中缺失，`MarkdownEditor` 顶栏暂无 `Export ▾` 按钮。
  - 这不影响 D9「决策」本身的冻结（格式清单已确定），但属于后续实现任务（C9–C11）的待办，需在看板登记。
  - 与本次 3 个 G0 任务（M0-1/M0-2/M0-3）无直接依赖关系。

## 三、签字栏

| 成员 | 角色 | 签字 | 日期 |
|------|------|------|------|
| A | 后端/数据/搜索/双链 + 技术协调 | | |
| B | Markdown 编辑器内核 | | |
| C | 主页/检索与双链 UI/导出/QA | | |

> 签字即视为 D1–D10 冻结；之后 API 与数据结构只允许加字段，不改语义（见计划第 2 节）。
