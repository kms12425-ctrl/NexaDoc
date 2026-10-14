# 单镜像交付：Express 同时提供前端静态资源与 REST/WS（同源，见 server/src/server.ts）
# 构建：docker build -t collaborative-docs-v2:dev .   或   docker compose up --build
# 刻意不写 `# syntax=docker/dockerfile:1`——避免构建时再去 Hub 拉 frontend 镜像（本 Dockerfile 无需 BuildKit 专有语法）
ARG NODE_IMAGE=node:22-alpine

# ── Stage 1: 前端构建 ──────────────────────────────────────────
FROM ${NODE_IMAGE} AS client-build
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm config set registry "$NPM_REGISTRY" && npm ci
COPY client/ ./
# tsc -p tsconfig.build.json（不含测试） && vite build → /app/client/dist
RUN npm run build

# ── Stage 2: 服务端编译 ────────────────────────────────────────
FROM ${NODE_IMAGE} AS server-build
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm config set registry "$NPM_REGISTRY" && npm ci
COPY server/ ./
# tsc -p tsconfig.build.json（排除 *.test.ts / src/test）→ /app/server/dist
RUN npm run build

# ── Stage 3: 服务端生产依赖（剔除 devDependencies）─────────────
FROM ${NODE_IMAGE} AS server-deps
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm config set registry "$NPM_REGISTRY" && npm ci --omit=dev

# ── Stage 4: 运行时（最小化）───────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY --from=server-deps  /app/server/node_modules ./node_modules
COPY --from=server-build /app/server/dist           ./dist
COPY --from=client-build /app/client/dist           ./public
EXPOSE 3001
# 健康检查用 Node 内置 fetch，避免依赖 curl/wget
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
