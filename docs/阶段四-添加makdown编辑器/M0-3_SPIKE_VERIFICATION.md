# M0-3 Spike 验证说明 + 录屏脚本

> 对应计划：附录 A「M0-3 Spike：CodeMirror + 左右实时预览 + 800ms 保存」（验收：录屏）
> 状态：技术验证已完成（代码就绪），待录屏
> 日期：2026-10-25

## 一、验证目标（3 个关键点）

1. CodeMirror 6 可作为 Markdown 源码编辑器挂载。
2. 「左侧源码 + 右侧实时预览」左右分栏，输入后实时更新。
3. 800ms 防抖自动保存（REST `PUT`），刷新后内容不丢。

## 二、代码证据（均已实现）

### 1. CodeMirror 6
- 文件：`client/src/components/markdown/MarkdownSource.tsx`
- 要点：
  - `basicSetup` + `@codemirror/lang-markdown`（`markdown({ codeLanguages: languages })`）+ `EditorView.lineWrapping`；
  - `[[` 双链自动补全（`autocompletion` override `wikiCompletion`，150ms 防抖在 suggest 侧、结果缓存 30s）；
  - 快捷键 `Mod-s`（立即保存）、`Mod-b`（加粗）、`Mod-i`（斜体）；
  - IME 处理：`compositionstart/end` 事件，避免中文输入丢字。

### 2. 左右实时预览
- 文件：`client/src/components/markdown/MarkdownPreview.tsx` + `MarkdownEditor.tsx`
- 要点：
  - `react-markdown` + `remark-gfm` + 自定义 `remarkWikiLink`，`skipHtml`（防 XSS）；
  - **80ms 防抖** + `useDeferredValue` + `memo` + 错误边界 `PreviewBoundary`；
  - 三态布局 `source / split / preview`，默认 `split`（`MarkdownEditor.tsx`）；
  - 左右滚动同步 `syncScroll`（按滚动比例映射）。

### 3. 800ms 自动保存
- 文件：`client/src/markdown/session/LocalMarkdownSession.ts`
- 要点：
  - `schedule()` → `setTimeout(saveNow, 800)`；
  - 保存走 `transport.save(markdown, revision, keepalive)`（`contentApi.ts` → `PUT /api/documents/:docId/markdown`）；
  - `visibilitychange` / `pagehide` 时 flush；`localStorage` 草稿 + 恢复提示；
  - `revision` 乐观并发 + `409 Conflict` 冲突弹窗（`MarkdownEditor.tsx` 的 `ConflictDialog`）。

## 三、录屏脚本（验收用，约 2 分钟）

| 步骤 | 操作 | 预期（录屏要拍到） |
|------|------|-------------------|
| 1 | 左上角 `☰` → `Markdown` → 新建空白文档 | 进入 `/markdown`，主页与 Docs 同构（模板区 + My documents） |
| 2 | 点击 Blank 模板 → 命名 → 创建 | 跳转 `/markdown/:id`，默认左右分栏 |
| 3 | 左侧输入 `# 标题`、列表、`- [x]` 任务、``` 代码块、`[[双链]]` | 右侧 80–150ms 内实时渲染，双链渲染为可点击链接 |
| 4 | 点击 `Source / Split / Preview` 三态 | 布局在三种状态间切换，窄屏可切换 |
| 5 | 拖动任一侧滚动 | 另一侧大致同步滚动，不互相抖动 |
| 6 | 停手约 1 秒 | 底部状态栏变为 `All changes saved` |
| 7 | 刷新页面 | 内容仍在（REST + MongoDB 已保存） |
| 8 | （可选）双标签页同时编辑 | 触发 `Conflict` 冲突提示，不静默覆盖 |

## 四、结论

- 三个验证点**全部由现有代码满足**，Spike 结论为「可行」，无需新增技术方案。
- 剩余动作仅为：按上表录屏并归档，作为 M0-3 的验收证据。
