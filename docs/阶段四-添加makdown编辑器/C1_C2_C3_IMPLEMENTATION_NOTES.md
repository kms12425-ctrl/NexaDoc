# C1/C2/C3 实施与测试记录

更新日期：2026-10-19。

本文统一记录阶段四中菜单入口（C1）、路由与守卫（C2）、公共组件抽取（C3）的实现、交互修订、测试结果和后续接入约定。

## 1. 完成范围与当前状态

| 任务 | 已完成内容 | 后续依赖与边界 |
|---|---|---|
| C1：AppMenu | 公共菜单、四个页面接入、工作区切换、当前项标记、键盘与焦点操作 | Markdown 新建和搜索统一放在主页，菜单不提供这两个快捷项 |
| C2：路由与守卫 | Markdown 路由、登录保护、懒加载、加载提示、双向类型纠正、错误与重试 | 真实 Markdown 类型识别仍需 A1/A3 返回 `editorType`；当前用模拟接口验证 |
| C3：公共组件 | 文档卡片和命名弹窗抽取、现有 DocsPage 接入、交互回归 | C4 实现 MarkdownHome 时复用这些组件 |

MarkdownHome 和 MarkdownEditor 当前为可导航的骨架。Markdown 模板、文档列表、创建、搜索、正文编辑、预览和保存尚未在本次任务中实现。

现有富文本主页继续支持模板选择、命名、文档列表、搜索和删除；其编辑器在元数据检查通过后初始化。

## 2. 文件与职责

以下路径相对于项目根目录。

| 文件 | 职责 |
|---|---|
| `client/src/components/AppMenu.tsx` | 全局工作区菜单及键盘交互 |
| `client/src/App.tsx` | 登录保护、路由声明、Markdown 页面懒加载 |
| `client/src/components/DocumentTypeGuard.tsx` | 编辑器挂载前读取元数据、判断类型、处理错误及重试 |
| `client/src/components/markdown/MarkdownHome.tsx` | Markdown 主页骨架、主页内的新建与搜索占位入口 |
| `client/src/components/markdown/MarkdownEditor.tsx` | 接收已验证元数据的 Markdown 编辑页骨架 |
| `client/src/components/shared/DocumentCard.tsx` | 普通/共享文档卡片、预览插槽、可选标签和摘要 |
| `client/src/components/shared/CreateDocModal.tsx` | 文档命名输入、确认/取消、焦点管理 |
| `client/src/components/DocsPage.tsx` | 复用公共组件，处理列表、模板、创建/删除请求和跳转 |
| `client/src/components/Editor.tsx` | 接收已验证元数据，初始化富文本标题、能力及协作会话 |
| `client/src/types/index.ts` | 客户端 `EditorType` 和可选 `DocumentMeta.editorType` |
| `client/src/index.css` | 菜单、骨架页面、公共卡片元数据和键盘焦点样式 |

## 3. C1：菜单与交互修订

### 3.1 菜单内容

`AppMenu` 的 `current` 参数支持 `docs`、`doc-editor`、`markdown`、`markdown-editor`。两个编辑器分别归属对应工作区，当前工作区显示选中标记。

| 菜单项 | 行为 |
|---|---|
| Docs | 进入 `/` |
| Markdown | 进入 `/markdown` |
| Settings | P0 禁用 |
| Help & feedback | 新标签页打开本仓库 Issues，使用 `noopener noreferrer` |

底部保留 `Privacy Policy · Terms of Service` 文案。

菜单位于 DocsPage、MarkdownHome 的 header 最左侧，以及两个编辑器 topbar 的返回入口之前。

### 3.2 新建和搜索归属主页

2026-10-19 根据用户明确的交互要求调整：

- 移除菜单中的 `New Markdown document` 和 `Search Markdown`。
- 新建按钮和搜索框仅放在 Markdown 主页。
- 移除此前用于菜单快捷入口的 `?new=1`、`?focusSearch=1` 特殊处理。
- 当前主页为骨架，新建按钮禁用，搜索框只读，并提示 Markdown 功能尚未开放。
- 后续由 C4/C6 和相关后端任务接入真实创建、搜索能力。

原有两个快捷项来自详细计划中的菜单设计；其功能此前仅跳转到占位提示。修订已同步到 `MARKDOWN_EDITOR_DETAILED_PLAN.md`。

### 3.3 键盘与焦点

- 点击触发按钮展开/关闭，点击菜单外部关闭。
- Escape 关闭后恢复触发按钮焦点。
- 方向键循环导航，Home/End 跳到首尾，自动跳过禁用项。
- 触发按钮上的 ArrowDown/ArrowUp 分别从首项/末项进入。
- Tab 关闭菜单并允许焦点离开。
- 提供 `aria-haspopup`、`aria-expanded`、`aria-controls` 和工作区选中状态。

## 4. C2：路由、懒加载与类型守卫

### 4.1 路由表

| 地址 | 页面 | 状态 |
|---|---|---|
| `/` | DocsPage | 现有富文本主页，过滤返回列表中的 Markdown 文档 |
| `/document/:id` | Editor | 通过元数据守卫后挂载富文本编辑器 |
| `/markdown` | MarkdownHome | 已接入的主页骨架 |
| `/markdown/:id` | MarkdownEditor | 通过元数据守卫后显示编辑页骨架 |
| `/login`、`/register` | 登录/注册页 | 沿用现有认证流程 |

Markdown 路由沿用 AuthProvider 登录保护。未登录时转到登录页。

两个 Markdown 页面使用 `React.lazy` 和 `Suspense`，在进入对应路由时加载，加载期间显示状态提示。

### 4.2 文档类型检查

`DocumentTypeGuard` 在挂载编辑器前读取元数据：

1. `editorType` 缺失时按 `rich` 处理，兼容历史数据。
2. Markdown 文档从 `/document/:id` 纠正到 `/markdown/:id`；富文本文档反向纠正。
3. 纠正使用 replace，保留 query、hash 和路由 state。
4. 元数据加载中不挂载正文编辑器，不建立 Yjs 房间连接。
5. 请求失败时显示错误与重试入口；401 时清理登录状态。
6. 文档 ID 改变或组件卸载时忽略过期请求结果。

富文本 Editor 接收已验证的 `metadata`，直接初始化标题和能力，避免重复请求以及类型确认前建立协作连接。reader 的只读能力也通过该元数据初始化。

页面守卫负责导航，不能替代后端的文档访问权限校验。

## 5. C3：公共组件与复用约定

### 5.1 DocumentCard

保留现有缩略图、标题、更新时间、颜色和普通/共享卡片样式。组件接收：

| 参数 | 用途 |
|---|---|
| `doc` | 文档元数据 |
| `preview` | 父页面提供的 React 预览节点 |
| `onOpen` | 打开文档回调 |
| `shared`（可选） | 共享卡片样式及元数据展示 |
| `tags`（可选） | 标签文本 |
| `snippet`（可选） | 摘要，可包含 `<mark>` 高亮节点 |
| `onDelete`（可选） | 提供时显示删除入口 |

富文本主页传入 TemplateThumbnail；Markdown 主页后续可传入自己的预览，并将 `onOpen` 指向 `/markdown/:id`。

卡片不请求接口，也不依赖具体编辑器或路由。实际删除操作与权限检查由父页面和服务端负责。

交互修正：

- 卡片支持鼠标、Enter、空格打开。
- 删除按钮的鼠标和键盘操作均不会触发卡片打开。
- 键盘聚焦卡片内部控件时显示删除入口。

### 5.2 CreateDocModal

组件接收 `value`、`placeholder`、`description`、`onChange`、`onConfirm`、`onClose`，负责受控输入及命名交互。

父页面保留当前模板、名称状态、默认名称计算、创建接口请求和创建后的跳转。现有空白模板默认使用 `Untitled document`，其他模板使用模板名；名称输入最多 120 个字符。

交互修正：

- 打开后聚焦名称输入框，Tab/Shift+Tab 在弹窗内循环。
- 关闭后，在原控件仍存在时恢复焦点。
- Enter 确认；Escape、Cancel 或点击遮罩关闭。
- 弹窗内部点击保持打开。
- 中文输入法组词期间的 Enter 不提交，Escape 不关闭弹窗。

模板选择器和删除确认弹窗仍由 DocsPage 管理。现有测试定位属性 `Document name`、`confirm-create-doc`、`Open document: ...` 保留。

## 6. 测试结果与验证边界

### 6.1 测试记录

| 阶段 | 验证结果 |
|---|---|
| C3 修改前基线 | 前端 111 个测试通过，类型检查通过 |
| C3 完成 | 12 个文件、127 个测试通过，新增 16 个；类型检查和构建通过；6 项浏览器测试通过 |
| C1/C2 首次完成 | 14 个文件、150 个测试通过；类型检查和构建通过；15 项浏览器测试通过，其中含 C3 的 6 项回归 |
| 菜单交互修订后 | 移除两项旧快捷导航用例，补充菜单不显示新建/搜索的断言；148 个前端测试通过；类型检查和构建通过；重跑的 2 项相关浏览器测试通过 |

最新前端测试数量为 **148**。浏览器完整套件的 15 项通过记录发生在菜单修订前；修订后重跑的是桌面菜单与 375px 窄屏键盘操作两个相关场景。

浏览器验证覆盖：菜单导航、登录拦截、懒加载、双向类型纠正、元数据返回前不初始化编辑器、错误重试、reader 只读、文档创建参数、删除确认和焦点操作。桌面及窄屏截图已检查。

### 6.2 构建与限制

- 两个 Markdown 页面形成独立 JS chunk，浏览器测试验证了进入 Markdown 前后对应脚本的加载行为。
- 菜单修订后主脚本 gzip 为 640.53 KB，相对 C3 的 637.75 KB 增加约 2.78 KB。
- `git diff --check` 通过。
- 浏览器测试使用 Edge/Playwright 和模拟 API/WebSocket，不写入真实 MongoDB。
- 本阶段未运行真实后端的完整协作端到端测试，也未验证完整 Markdown 编辑与保存。
- 构建仍有既有的大体积 bundle 提示，测试仍有 React Router v7 迁移提示。

### 6.3 测试文件

- `client/src/components/AppMenu.test.tsx`
- `client/src/App.test.tsx`
- `client/src/components/DocsPage.test.tsx`
- `client/src/components/shared/DocumentCard.test.tsx`
- `client/src/components/shared/CreateDocModal.test.tsx`
- `client/e2e/workspace-navigation.spec.ts`
- `client/e2e/shared-components.spec.ts`

### 6.4 复现命令

PowerShell 中执行前端检查：

```powershell
Set-Location 'V:\sortpiece\Software-Engineering-Project\client'
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

已启动前端且安装 Playwright Chromium 后，可在客户端目录运行浏览器测试：

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:5173'
npx.cmd playwright test e2e/workspace-navigation.spec.ts e2e/shared-components.spec.ts
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

这两个浏览器测试文件使用模拟数据，不依赖真实数据库完成其场景验证。

## 7. 后续任务接入清单

| 对接任务 | 下一步 |
|---|---|
| A1/A3 | 扩展后端模型及元数据接口，返回 `editorType`，与前端类型守卫联调 |
| A 的权限任务 | 独立实现 Markdown owner-only，覆盖已有 REST 和 WebSocket 入口 |
| C4 | 扩展 MarkdownHome，复用 C3 卡片与命名弹窗，接入模板、列表和创建流程 |
| C5 | 提供 Markdown 纯字符串模板，并随创建请求提交正文 |
| C6 与搜索后端 | 在 Markdown 主页启用真实搜索、高亮摘要和查询状态 |
| B 的编辑器任务 | 扩展 MarkdownEditor，消费已验证的 `metadata`，接入源码、预览、会话和保存 |

后续继续保持新建和搜索由 Markdown 主页承载。P0 Markdown 编辑页不显示 Share、Comments、History，也不接入富文本协作会话。
