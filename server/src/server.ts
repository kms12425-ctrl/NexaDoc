import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import { WebSocketServer } from 'ws'

// y-websocket/bin/utils 没有 TypeScript 类型声明，用 require 避免 TS 报错
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setupWSConnection } = require('y-websocket/bin/utils')

/* ─── Configuration ───────────────────────────────────────────── */
const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

/* ─── App bootstrap ───────────────────────────────────────────── */
const app = express()

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  })
)

/* Health-check endpoint */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

const server = http.createServer(app)

/* ─── Yjs WebSocket server (noServer mode) ────────────────────── */
/**
 * Attach a Yjs WebSocket server to the same HTTP server on the /yjs path.
 * noServer: true — it shares the HTTP server's port; no second port is opened.
 *
 * 前缀匹配 /yjs——处理 ws://host/yjs/<docName> 格式。
 * 原项目用 pathname === '/yjs' 精确匹配，但客户端连接的 URL 是
 * ws://host/yjs/<docId>（pathname = '/yjs/<docId>'），精确匹配不通过 → Yjs WS 实际未连接。
 * 改为 startsWith('/yjs') 修复此问题。
 *
 * TODO(阶段三): 在此处插入认证钩子——从 request.headers 提取 token 验证用户身份
 * TODO(阶段四): 从 URL 提取 docName，查询用户对该文档的权限
 *               如果无权限 → socket.destroy() 拒绝连接
 *               如果有权限 → wss.handleUpgrade(...)
 */
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true })

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '/', 'http://x').pathname

  if (pathname.startsWith('/yjs')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }
  // 其他 upgrade 请求忽略（不 destroy，让其他中间件处理）
})

/* ─── Start server ────────────────────────────────────────────── */
server.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
  console.log(`[server] Accepting connections from: ${CLIENT_ORIGIN}`)
  console.log(`[server] Yjs WebSocket on path: /yjs/<docName>`)
})

/* ─── Graceful shutdown ───────────────────────────────────────── */
function shutdown(signal: string) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully…`)
  server.close(() => {
    console.log('[server] HTTP server closed.')
    process.exit(0)
  })
  // Force quit after 5 seconds if still open
  setTimeout(() => {
    console.error('[server] Forced exit after timeout.')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
