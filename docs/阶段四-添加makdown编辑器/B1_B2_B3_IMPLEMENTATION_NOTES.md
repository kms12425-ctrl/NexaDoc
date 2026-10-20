# B1/B2/B3 实施与测试记录

更新日期：2026-10-20。

## 1. 完成范围

| 任务 | 实现结果 |
|---|---|
| B1：源码输入 | 安装 CodeMirror 6 及语言依赖；源码输入、Markdown/代码语法高亮、行号、撤销、搜索、只读重配置、挂载/销毁清理 |
| B2：编辑会话 | MarkdownSession 接口、LocalMarkdownSession；800ms 自动保存、300ms 草稿节流、恢复选择、离线重试、离开/后台保存、修订冲突处理 |
| B3：实时预览 | react-markdown、remark-gfm、自定义 remarkWikiLink；80ms 防抖与 deferred 渲染；标题、列表、表格、任务、代码和双链 |
| B2 必要后端依赖 | 补齐 A5 的正文 GET/PUT、owner-only、原子 revision 检查；添加保存所需的 A6 分析和批量目标解析辅助逻辑 |

现在可以完成“新建模板 → 输入源码 → 查看预览 → 自动保存 → 刷新继续编辑”的实际流程。全部数据库验证在独立临时 MongoDB 中进行，没有连接或迁移开发数据库。

本次提供基础的桌面双栏和手机上下排列。**B4 的 Source/Split/Preview 三态、比例滚动同步、完整状态栏，B5 的格式工具栏，B6 的补全，以及 B7 的标签/标题编辑仍需后续完成**。冲突处理作为 B2 必要行为已实现，不能据此将整个 B7 标为完成。

## 2. B1：CodeMirror 源码编辑

`MarkdownSource` 创建独立的 EditorView，不使用受控 textarea。CodeMirror 管理输入、选择和历史；文档变化提交给会话，会话的外部正文变化再同步回编辑器，不反向触发重复更新。

- 使用 basicSetup、Markdown 语言包和 language-data，代码语言按需加载。
- 同时配置 EditorState.readOnly 和 EditorView.editable；权限变化通过 Compartment 更新，不重建编辑器或清空撤销历史。
- 支持 CodeMirror 默认撤销/搜索快捷键，额外提供 Ctrl/Cmd+S 保存。
- 组合输入开始时暂停正文自动保存；结束后等待提交文本被消费，再开始 800ms 保存计时。
- 卸载时解除订阅、清理组合输入定时器并销毁 EditorView。

## 3. B2：会话、草稿及冲突

### 自动保存

输入停止 800ms 后保存；手动 Save now 或 Ctrl/Cmd+S 可立即保存。写请求串行执行：保存过程中又输入新内容时，先接收前一请求的修订号，再提交最新内容。旧请求成功不会清掉更新的草稿，也不会丢失“保存过程中撤回到原文”的变化。

状态包括 idle、saving、saved、offline、conflict。网络失败保留正文和本地草稿；恢复网络时自动重试，也可点击 Save now。身份或权限失效后停止继续写入，401 会退出登录。

### 本地草稿

键名为：

```text
md_draft:<编码后的用户ID>:<编码后的文档ID>
```

相较计划的单纯 docId，增加用户命名空间，避免同一浏览器切换账户后读取其他人的草稿。

草稿包含 markdown、revision、savedAt；每 300ms 最多写入一次。成功保存后仅删除与已保存正文相同的草稿，保留其他窗口或后续输入产生的不同内容。

打开文档时：

- 草稿内容等于服务器正文：清理重复草稿。
- 存在不同的本地草稿：显示 Recover draft / Use server version，选择前源码只读，不自动覆盖服务器。
- 恢复后修订号与服务器不同：进入冲突流程，要求明确选择。
- 旧时间戳或旧修订号的不同草稿也允许用户检查，避免时钟偏差、请求中断或旧冲突造成内容被静默丢弃。
- 存储损坏或配额不足不会阻止网络保存；本地存储不可用时显示提示。

### 离开和切后台

切到后台时先写草稿，再发正常保存请求；离开页面或组件卸载时先同步写最新草稿，小于 60,000 字节的 JSON 保存体尝试 keepalive。大正文或大量转义导致 JSON 超限时，离开页面保留本地草稿，不依赖大体积 keepalive 请求。

浏览器退出时的网络发送属于尽力补存；草稿仍是异常中断时的恢复依据。退出登录后不会用新账户的 token 替旧会话保存正文。

### 修订冲突

服务器返回 409 时暂停自动保存，显示 Save conflict 弹窗：

- **Load latest**：重新读取最新服务器正文，替换本地显示。
- **Keep mine and overwrite**：保留当前源码，使用冲突响应的修订号重新尝试保存；若服务器再次变化，会再次冲突，不能无条件覆盖。
- **Review my source / Escape**：暂时关闭弹窗以检查源码，保存仍暂停，可通过 Resolve conflict 重新打开。

弹窗支持焦点约束及关闭后焦点归还。原文保留到用户明确选择处理方式。

## 4. B3：预览及双链

支持标题、强调、列表、引用、代码块、GFM 表格、任务列表、删除线和链接。输入后 80ms 更新预览，使用 deferred value 降低预览对输入的干扰；组件 memo 化，渲染器引用保持稳定。

安全与容错：

- 不引入 rehype-raw，skipHtml 忽略原始 HTML。
- 保留 react-markdown 默认 URL 过滤，javascript 等危险 URL 不会执行。
- 外部 HTTP(S) 链接新标签打开，设置 noopener noreferrer。
- 代码内容作为文本展示；图片使用受过滤的地址。
- 空内容显示占位，渲染边界与编辑器分离，预览异常不移除源码。

`[[标题]]` 和 `[[标题|显示文字]]` 仅转换普通文本节点；代码块、行内代码、已有 Markdown 链接和转义示例不转换。读取当前用户 Markdown 列表后，唯一标题链接至对应文档；未找到或重名时链接至主页标题筛选，不随意选择目标。此处不包含 B6 补全或 C8 反链面板。

## 5. 配套后端正文接口

```http
GET /api/documents/:docId/markdown
```

返回 markdown、revision、updatedAt。

```http
PUT /api/documents/:docId/markdown
Content-Type: application/json

{ "markdown": "# 修改后的正文\n", "baseRevision": 0 }
```

成功返回 revision 和 updatedAt。服务器：

- 要求登录且为 Markdown owner；rich、已删除、无权限文档返回 404。
- 校验正文为字符串，最大 2 MiB；baseRevision 为合法非负安全整数。
- 原子匹配文档类型、owner、删除状态及 revision，更新正文和派生索引并递增修订号；兼容缺失 revision 的旧 Markdown 记录。
- 版本不匹配时返回 409 和当前 markdown/revision/updatedAt，不覆盖正文。
- 不更新标题、标签或 CRDT 状态，不进入 Yjs。
- 保存时分析基础文本与双链；排除代码围栏、行内代码和转义示例。目标只在当前用户拥有、未删除的 Markdown 中批量查找；重名或不可见目标保留 null。
- 预留 MARKDOWN_COLLAB_ENABLED=true 时的 REST 写入拒绝；这不表示 P2 协作已实现。

A8 的反链/出链 API、改名后回填和完整链接管理仍未实现。创建接口沿用 A2 的初始 outgoingLinks 约定，完整出链在正文保存时刷新。

## 6. 文件位置

| 项目相对路径 | 职责 |
|---|---|
| client/src/components/markdown/MarkdownEditor.tsx | 加载、状态、恢复/冲突 UI、会话生命周期 |
| client/src/components/markdown/MarkdownSource.tsx | CodeMirror 输入、只读和组合输入 |
| client/src/components/markdown/MarkdownPreview.tsx | 安全预览与预览错误边界 |
| client/src/markdown/remarkWikiLink.ts | 普通文本节点双链转换 |
| client/src/markdown/contentApi.ts | 正文请求、结构化冲突、keepalive 限制 |
| client/src/markdown/session/MarkdownSession.ts | 编辑器会话接口 |
| client/src/markdown/session/LocalMarkdownSession.ts | 串行保存、草稿、恢复及浏览器事件 |
| server/src/routes/markdown.ts | 正文 GET/PUT 与 revision 比较更新 |
| server/src/markdown/analyze.ts | 保存时正文与双链分析 |
| server/src/markdown/resolveLinkTargets.ts | 当前用户范围内批量解析目标 |
| client/e2e-markdown-live/editor.spec.ts | 真实编辑器浏览器联调 |

客户端 package.json/package-lock.json 已更新并安装依赖。生产 MarkdownEditor 仍懒加载，约 817 kB、gzip 272 kB；代码语言另行按需加载。Vite 对大于 500 kB 的 chunk 有提示，尚未进行完整包体优化。

## 7. 测试结果

| 检查 | 结果 |
|---|---|
| 前端类型检查、生产构建 | 通过 |
| 前端全量单元/集成测试 | 20 个文件、210 项通过，比上一轮增加 33 项 |
| 服务端类型检查、生产构建 | 通过 |
| 服务端全量测试 | 14 个文件、205 项通过，比上一轮增加 32 项 |
| 真实 Express/MongoDB/Edge 浏览器测试 | 17 项通过，含既有 5 项和新增 12 项；42.4 秒 |
| C1—C5 模拟接口浏览器回归 | 24 项通过；41.0 秒 |

新增前端用例包含会话 20、正文传输 5、预览 8 项；新增服务端用例包含正文接口 23、分析 9 项。

真实浏览器验证了：

1. 源码输入、GFM 预览、精确落库及刷新保留。
2. Ctrl+S、撤销及恢复后的再次保存。
3. 离线大草稿、刷新后的恢复提示、恢复后落库和显式放弃草稿。
4. 两个真实标签页的冲突与明确覆盖、加载最新版本。
5. 通过 Chromium CDP 组合事件验证中文输入提交前不保存候选文本；这不是对所有操作系统输入法的完整人工验收。
6. 离开页面补存、5,000 行文档的虚拟化源码视图及编辑保存。
7. 双链跳转、原始 HTML 不执行、加载失败重试和 375px 布局。

已检查桌面和手机截图。首轮恢复用例中，小文档在刷新前通过 keepalive 成功补存，因此无需恢复；测试改用超出退出补存阈值、确实只存在于本地的大草稿后，完整验证恢复流程。最终 17 项真实测试一次全部通过。

复现命令：

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

浏览器测试沿用独立临时 MongoDB、3018 测试服务器和 5186/5187 模拟回归预览，不连接开发数据库。当前浏览器覆盖为本机 Edge，其他浏览器及更完整的大文档性能属于 B9/C13 后续验收。

## 8. 现在如何使用

重启前后端，登录后进入 `☰ → Markdown`，新建模板或打开已有文档。左侧编辑 Markdown，右侧查看预览，停止输入约 800ms 后观察 Saved。刷新页面应保留内容，也可点击 Save now 或使用 Ctrl/Cmd+S。

网络中断后不要清除浏览器存储；重新打开文档若出现 Unsaved draft found，可选择恢复。两个窗口同时修改时，按冲突弹窗选择加载服务器版本或保留自己的源码。

参考实现文档：[CodeMirror 基础编辑器](https://codemirror.net/examples/basic/)、[CodeMirror 动态配置](https://codemirror.net/examples/config/)、[react-markdown API 与安全说明](https://github.com/remarkjs/react-markdown)。
