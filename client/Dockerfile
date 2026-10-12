# 独立构建前端静态镜像（方案 B / 单独部署场景）
#   docker build -f client/Dockerfile -t collaborative-docs-v2-web client
# nginx 同时承担 SPA 回退与 /api、/yjs、/ws 反向代理（含 WebSocket 升级）
ARG NODE_IMAGE=node:22-alpine

# ── 构建静态资源 ──
FROM ${NODE_IMAGE} AS build
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry "$NPM_REGISTRY" && npm ci
COPY . .
RUN npm run build

# ── 运行时：nginx ──
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
