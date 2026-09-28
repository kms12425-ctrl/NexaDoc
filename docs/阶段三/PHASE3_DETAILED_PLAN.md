# 阶段三详细计划：工程化升级

> **目标**：在阶段一（JS→TS, Quill→TipTap, Yjs CRDT）和阶段二（三层架构 + MongoDB + JWT + RBAC）基础上，补齐工程化能力，使 `NexaDoc` 具备可测试、可部署、可维护、可治理的开源项目形态。

> **原则**：保持 Node.js/TypeScript + React 技术栈不变；不引入异构后端。

---

## 目录

- [工程化目标](#工程化目标)
- [Task 1：测试体系搭建](#task-1测试体系搭建)
- [Task 2：容器化与一键启动](#task-2容器化与一键启动)
- [Task 3：CI/CD 流水线](#task-3cicd-流水线)
- [Task 4：环境配置管理](#task-4环境配置管理)
- [Task 5：治理文档与社区规范](#task-5治理文档与社区规范)
- [Task 6：服务端模块化重构](#task-6服务端模块化重构)
- [Task 7：可观测性、安全与国际化（生产化延伸）](#task-7可观测性安全与国际化生产化延伸)
- [执行顺序与依赖](#执行顺序与依赖)
- [验收标准](#验收标准)

---

## 工程化目标

| 维度 | 当前状态（v2） | 目标状态 | 对应 Task |
|---|---|---|---|
| 测试 | 0 个测试文件 | 后端单元 + 前端单元 + e2e | Task 1 |
| 容器化 | 无 Dockerfile/compose | Dockerfile + compose.yml | Task 2 |
| CI/CD | `.github/workflows` 为空 | lint + test + build 流水线 | Task 3 |
| 环境配置 | 无 `.env.example` | 分环境 env 模板 | Task 4 |
| 治理文档 | 仅 README + 阶段笔记 | CONTRIBUTING/CHANGELOG/SECURITY/ADR | Task 5 |
| 服务端结构 | 8 个平铺 .ts 文件 | 按域分模块 | Task 6 |
| 可观测性/安全/i18n | 基本无 | profiling/healthcheck/CSP/i18n 框架 | Task 7 |

---

## Task 1：测试体系搭建

**痛点**：当前 `find ... -name "*.test.*"` 结果为空，任何改动都无回归保障。

### 1.1 后端单元测试（Vitest）

**新增** `server/vitest.config.ts`：
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', coverage: { provider: 'v8', include: ['src/**/*.ts'] } },
});
```

**首批用例**（优先覆盖核心纯逻辑）：
- `src/auth.ts` — JWT 签发/校验、过期、非法 token
- `src/rbac.ts` — 角色判定、权限矩阵
- `src/docId.ts` — docId 生成、校验、规范化
- `src/persistence.ts` — MongoDB 读写（用 `mongodb-memory-server` 做内存 DB）
- `src/routes/*.ts` — 用 `supertest` 跑 Express 路由集成测试

**目标覆盖率**：核心模块 ≥ 70%，整体 ≥ 50%。

### 1.2 前端单元测试（Vitest + Testing Library）

**新增** `client/vitest.config.ts`，安装 `@testing-library/react`、`@testing-library/jest-dom`、`jsdom`。

**首批用例**：
- `components/` 下关键交互组件（文档列表、编辑器工具栏、模态框）
- `services/` API 封装（mock fetch / axios）
- `contexts/` AuthContext 状态流转
- `utils/` 纯函数

### 1.3 端到端测试（Playwright）

**新增** `client/e2e/` 目录与 `playwright.config.ts`。

**关键场景**：
- 登录 → 创建文档 → 实时编辑 → 保存
- 多用户协作（两个 browser context）光标与内容同步
- 文档导出（PDF/DOCX）
- RBAC：viewer 不能编辑

### 1.4 npm scripts

```jsonc
// server/package.json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"

// client/package.json
"test": "vitest run",
"test:e2e": "playwright test"
```

**依赖新增**：`vitest`、`@vitest/coverage-v8`、`supertest`、`mongodb-memory-server`、`@testing-library/react`、`@testing-library/jest-dom`、`jsdom`、`@playwright/test`。

---

## Task 2：容器化与一键启动

**痛点**：新贡献者无法 `docker compose up` 一键拉起。

### 2.1 Dockerfile（多阶段）

**新建** `Dockerfile`（根目录，统一构建 client + server）：
- Stage `client-build`：`node:20-alpine` → `yarn build` 产物到 `client/dist`
- Stage `server-deps`：安装 server 生产依赖
- Stage `runtime`：仅拷贝产物 + 生产依赖，暴露 3001 端口，`CMD ["node", "server/dist/server.js"]`

**新建** `server/Dockerfile` 与 `client/Dockerfile`（单独可构建场景）。

### 2.2 docker compose

**新建** `compose.yml`：
```yaml
services:
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongo-data:/data/db"]
  app:
    build: .
    ports: ["3001:3001"]
    env_file: .env
    depends_on: [mongo]
volumes:
  mongo-data:
```

**新建** `compose.e2e.yml`：单独跑 Playwright（挂载构建产物 + e2e 目录）。

### 2.3 .dockerignore

`node_modules`、`*.log`、`.git`、`client/dist`、`server/dist`、`.env`。

### 2.4 验证

```bash
docker compose up --build
# 期望：mongo + app 启动，http://localhost:3001/health 返回 200
```

---

## Task 3：CI/CD 流水线

**痛点**：`.github/workflows/` 为空，PR 无自动校验。

### 3.1 ci.yml（主流水线）

触发：`push` 到 main、所有 PR。

Jobs：
1. **lint** — `yarn lint`（client + server）
2. **test-server** — `cd server && yarn test:coverage`，上传 coverage 报告
3. **test-client** — `cd client && yarn test`，`yarn test:e2e`（带 mongo service container）
4. **build** — `yarn build`，上传构建产物 artifact
5. **docker-build** — `docker build .` 验证镜像可构建（不推送）

### 3.2 docker-publish.yml（发布）

触发：打 tag `v*`。
- 构建多架构镜像并推送到 GHCR（`ghcr.io/<owner>/NexaDoc`）。

### 3.3 依赖矩阵

用 GitHub Actions 的 service container 起 MongoDB，保证 e2e 在 CI 中可跑。

**示例**：
```yaml
services:
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
```

---

## Task 4：环境配置管理

**痛点**：无 `.env.example`，新开发者不知道需要哪些变量。

### 4.1 `.env.example`

**新建**根目录 `.env.example`，列出全部环境变量及注释：
```env
# Server
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nexadoc
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173

# Client
VITE_API_URL=http://localhost:3001
VITE_YJS_WS_URL=ws://localhost:3001/yjs
```

### 4.2 分环境模板

分环境模板示例：
- `env.d/development.example`
- `env.d/production.example`

### 4.3 配置加载统一化

`server/src/config.ts`：用 `dotenv` + zod schema 校验环境变量，启动时 fail-fast，避免运行时才发现缺配置。

`client/src/config.ts`：集中 `import.meta.env` 读取，避免散落各文件。

### 4.4 .gitignore 更新

确保 `.env`、`.env.local`、`.env.*.local` 被忽略，只提交 `*.example`。

---

## Task 5：治理文档与社区规范

**痛点**：仅有 README，外部贡献者无规范可循。

### 5.1 新增文件

| 文件 | 内容要点 |
|---|---|
| `CONTRIBUTING.md` | 开发环境搭建、分支策略、commit 规范（Conventional Commits）、PR 模板、测试要求 |
| `CHANGELOG.md` | Keep a Changelog 格式，回填阶段一/二/三变更 |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1 |
| `SECURITY.md` | 漏洞上报流程、支持版本、响应 SLA |
| `UPGRADE.md` | 版本升级指南（阶段一→二→三破坏性变更） |
| `documentation/adr/` | 架构决策记录：ADR-001 TipTap over Quill、ADR-002 Yjs CRDT、ADR-003 MongoDB、ADR-004 Vitest over Jest 等 |
| `.github/PULL_REQUEST_TEMPLATE.md` | Summary / Test plan / Breaking changes checklist |
| `.github/ISSUE_TEMPLATE/` | bug、feature、question 模板 |

### 5.2 commit 规范工具

新增 `commitlint` + `@commitlint/config-conventional`、`husky` pre-commit hook 跑 lint + test，`.github/workflows/` 加 commitlint job。

### 5.3 README 增强

补充：徽章（CI、coverage、license）、Quick Start（docker compose 一键）、贡献入口链接、升级指引。

---

## Task 6：服务端模块化重构

**痛点**：`server/src/` 8 个平铺 `.ts` 文件，无边界，随功能增长会失控。

### 6.1 目标结构

```
server/src/
  config/            # 配置加载
    index.ts
  modules/
    auth/
      auth.controller.ts
      auth.service.ts
      auth.routes.ts
      auth.test.ts
    documents/
      documents.controller.ts
      documents.service.ts
      documents.routes.ts
      documents.test.ts
    collaboration/
      yjs-provider.ts
      awareness.ts
    rbac/
      rbac.service.ts
      rbac.middleware.ts
  middleware/        # 通用中间件（error、cors、auth-guard）
  app.ts             # Express app 装配
  server.ts          # 入口
```

### 6.2 重构原则

- 按域（domain）划分模块，每模块自包含 controller/service/routes/test。
- 公共中间件抽到 `middleware/`。
- 路由在 `app.ts` 统一挂载。
- 保持对外 API 路径不变，纯内部重组。

### 6.3 风险控制

- 先补测试（Task 1）再重构，确保行为不回归。
- 分模块小步迁移，每模块独立 PR。
- 用 `codebase_graph_explore` 确认调用链后再动。

---

## Task 7：可观测性、安全与国际化（生产化延伸）

> 本 Task 为进阶项，可按需取舍，优先级低于 1-6。

### 7.1 健康检查与可观测性

- `/health` 端点：检查 DB 连接、Yjs provider 存活。
- `/readiness`：细粒度就绪探测。
- 结构化日志：`pino`，统一 request id。
- 性能 profiling：`clinic.js` 或轻量中间件，文档 `documentation/profiling.md`。

### 7.2 安全加固

- CSP 中间件：`helmet`，配置 `Content-Security-Policy`。
- 速率限制：`express-rate-limit` 登录/注册端点。
- 依赖扫描：CI 加 `npm audit` / Snyk action。
- 安全审计文档 `secu-audit.md`：记录已知风险与缓解。

### 7.3 国际化框架（i18n）

- 前端：`react-i18next`，抽离硬编码文案到 `locales/zh-CN.json`、`locales/en.json`。
- 后端：错误消息支持多语言 key。
- 不做完整翻译，只搭框架 + 中英两套样例。

### 7.4 部署模板（可选）

- `src/helm/` 或 `deploy/`：提供基础 Helm Chart / k8s manifest。
- `publiccode.yml`：政府/公共代码元数据（如需进入 DPG 体系）。

---

## 执行顺序与依赖

```
Task 1 (测试) ──┬─► Task 6 (服务端重构)  ──► Task 7 (生产化)
                │
Task 4 (env)  ──┼─► Task 2 (容器化) ──► Task 3 (CI/CD)
                │                          ▲
Task 5 (治理) ──┘──────────────────────────┘
```

**建议顺序**：
1. Task 4（env 配置）— 最快，无依赖，为后续容器化铺路
2. Task 1（测试）— 重构的前置保障
3. Task 5（治理文档）— 可并行，轻量
4. Task 2（容器化）— 依赖 env
5. Task 3（CI/CD）— 依赖测试 + 容器
6. Task 6（服务端重构）— 依赖测试
7. Task 7（生产化）— 最后，按需

---

## 验收标准

| Task | 验收点 |
|---|---|
| 1 | `yarn test` 在 client + server 全绿，核心模块 coverage ≥ 50%，e2e 至少 3 个场景通过 |
| 2 | `docker compose up --build` 一键起服务，`/health` 200，浏览器可访问编辑器 |
| 3 | PR 提交后 CI 自动跑 lint/test/build，全部 must-pass |
| 4 | `.env.example` 完整；启动时缺关键变量会 fail-fast 报清晰错误 |
| 5 | CONTRIBUTING/CHANGELOG/SECURITY 齐全；commit 规范有 hook 强制；README 含 Quick Start |
| 6 | `server/src/modules/` 分模块；API 路径不变；测试全绿 |
| 7 | /health、结构化日志、helmet CSP、i18n 框架就位 |

---

*本计划为阶段三工程化升级蓝图，执行时按 Task 拆分为独立 PR，逐项推进。*
