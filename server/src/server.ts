import express, { Request, Response } from 'express'
import http from 'http'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'

// y-websocket/bin/utils 没有 TypeScript 类型声明，用 require 避免 TS 报错
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils')

import { connectDB, getDB, closeDB } from './db'
import { mongoPersistence, flushAll, beginShutdown } from './persistence'
import { register, login, requireAuth, AuthRequest } from './auth'
import { addConnection, removeConnection, closeAllConnections } from './notifications'
import { resolveAccess } from './rbac'
import { decodeDocName } from './docId'
import type { WebSocket } from 'ws'
import documentsRouter from './routes/documents'
import snapshotsRouter from './routes/snapshots'
import sharingRouter from './routes/sharing'
import commentsRouter from './routes/comments'

/* ─── Configuration ───────────────────────────────────────────── */
const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

/* ─── App bootstrap ───────────────────────────────────────────── */
const app = express()

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)
app.use(express.json())

/* ── Health-check ── */
app.get('/health', (_req: Request, res: Response) =>
{
  res.json({ status: 'ok', uptime: process.uptime() })
})

/* ── Auth routes ── */
app.post('/api/auth/register', register)
app.post('/api/auth/login', login)
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) =>
{
  res.json({ user: req.user })
})

/* ── REST API routes ── */
app.use('/api/documents', requireAuth, documentsRouter)
app.use('/api/documents', requireAuth, sharingRouter)
app.use('/api/documents', requireAuth, commentsRouter)
app.use('/api/documents', requireAuth, snapshotsRouter)

/* ── 生产环境：托管前端构建产物（容器镜像内路径 /app/public）── */
// 目录不存在时（纯开发模式）整段跳过，不影响 Vite :5173 的开发流程
const CLIENT_DIST = process.env.CLIENT_DIST || path.resolve(__dirname, '..', 'public')
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: 'index.html' }))

  // SPA fallback：Express 5 不再支持 app.get('*')（path-to-regexp v8 要求具名通配符），
  // 故用无路径中间件实现；放行 /api、/yjs、/ws、/health 与「带扩展名的静态资源」，
  // 避免接口 404 被吞、以及缺失的 .js/.css 被换成 HTML（会触发 MIME 类型报错）
  app.use((req, res, next) =>
  {
    const p = req.path
    const isEndpoint =
      p.startsWith('/api') || p.startsWith('/yjs') || p.startsWith('/ws') || p === '/health'
    const isAsset = path.extname(p) !== ''
    if (req.method !== 'GET' || isEndpoint || isAsset) {
      next()
      return
    }
    res.sendFile(path.join(CLIENT_DIST, 'index.html'))
  })
}

/* ── Global error handler ── */
app.use((err: Error, _req: Request, res: Response, _next: any) =>
{
  console.error('[api] ERROR:', err.message, err.stack)
  res.status(500).json({ error: 'Internal server error', detail: err.message })
})

/* ─── Yjs WebSocket server (noServer mode) ────────────────────── */
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true })

// 注册 MongoDB 持久化层（y-websocket v2 用 setPersistence 全局设置）
setPersistence(mongoPersistence)

wss.on('connection', (ws, req) =>
{
  // 从 URL 提取 docName：/yjs/<docId> → <docId>
  // 必须先解码（浏览器对非 ASCII 路径会 percent-encode），
  // 否则 docName 与 REST 层使用的 docId 不是同一个 key（详见 docId.ts）
  const docName = decodeDocName(new URL(req.url || '/', 'http://x').pathname)

  setupWSConnection(ws, req, { docName })
})

// ── 通知 WebSocket Server（用户级实时推送）──
const notifyWss = new WebSocketServer({ noServer: true })

notifyWss.on('connection', (ws: WebSocket, userId: string) =>
{
  addConnection(userId, ws)

  ws.on('close', () =>
  {
    removeConnection(userId, ws)
  })

  ws.on('error', (err) =>
  {
    console.error(`[notifications] WS error for user ${userId}:`, err)
    removeConnection(userId, ws)
  })

  // 发送确认消息
  ws.send(JSON.stringify({ type: 'connected', userId }))
})

const server = http.createServer(app)

/** 拒绝 WebSocket 升级请求：写回状态行后立即关闭 socket */
function rejectUpgrade(
  socket: { write(chunk: string): unknown; destroy(): void },
  status: number,
  message: string
): void
{
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`)
  socket.destroy()
}

server.on('upgrade', (request, socket, head) =>
{
  const url = new URL(request.url || '/', 'http://x')
  const pathname = url.pathname

  // ── 路由 1: /ws/notifications — 用户级通知 ──
  if (pathname === '/ws/notifications') {
    const token = url.searchParams.get('token')
    if (!token) {
      rejectUpgrade(socket, 401, 'Unauthorized')
      return
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: string }
      notifyWss.handleUpgrade(request, socket, head, (ws) =>
      {
        notifyWss.emit('connection', ws, payload.id)
      })
    } catch {
      rejectUpgrade(socket, 401, 'Unauthorized')
    }
    return
  }

  // ── 路由 2: /yjs/<docId> — 文档级 CRDT 同步（JWT + 文档访问权限）──
  if (pathname.startsWith('/yjs')) {
    const token = url.searchParams.get('token')
    if (!token) {
      rejectUpgrade(socket, 401, 'Unauthorized')
      return
    }

    let userId: string
    try {
      userId = (jwt.verify(token, JWT_SECRET) as { id: string }).id
    } catch {
      rejectUpgrade(socket, 401, 'Unauthorized')
      return
    }

    // 与 REST 层共用同一套规则（rbac.resolveAccess），避免「界面能编辑、同步却被拒」
    resolveAccess(decodeDocName(pathname), userId)
      .then((access) =>
      {
        if (!access) {
          rejectUpgrade(socket, 404, 'Document Not Found')
          return
        }
        if (!access.abilities.canEdit) {
          rejectUpgrade(socket, 403, 'Forbidden')
          return
        }
        wss.handleUpgrade(request, socket, head, (ws) =>
        {
          wss.emit('connection', ws, request)
        })
      })
      .catch((err) =>
      {
        console.error('[yjs] access check failed:', err)
        rejectUpgrade(socket, 500, 'Internal Server Error')
      })
    return
  }

  // ── 未知路径 ──
  rejectUpgrade(socket, 404, 'Not Found')
})

/* ─── Start server ────────────────────────────────────────────── */
async function start(): Promise<void>
{
  await connectDB()
  server.listen(PORT, () =>
  {
    console.log(`[server] Running on http://localhost:${PORT}`)
    console.log(`[server] Accepting connections from: ${CLIENT_ORIGIN}`)
    console.log(`[server] Yjs WebSocket on path: /yjs/<docName>`)
  })
}

start().catch((err) =>
{
  console.error('[server] Failed to start:', err)
  process.exit(1)
})

/* ─── Graceful shutdown ───────────────────────────────────────── */
async function shutdown(signal: string): Promise<void>
{
  console.log(`\n[server] Received ${signal}. Shutting down gracefully…`)

  // 兜底：10s 内没退干净就强制退出（docker stop 默认也是 10s 后 SIGKILL）
  const force = setTimeout(() =>
  {
    console.error('[server] Forced exit after timeout.')
    process.exit(1)
  }, 10_000)
  force.unref()

  try {
    // 0) 进入退出态：此后 y-websocket 断连触发的 writeState 会被跳过（由 flushAll 统一回写）
    beginShutdown()

    // 1) 停止接收新连接，并关掉 keep-alive 长连接（否则 server.close() 要等客户端主动断开）
    server.close()
    server.closeAllConnections()

    // 2) 断开两条 WebSocket 通道上的客户端后关闭服务
    closeAllConnections()
    for (const ws of wss.clients) ws.terminate()
    await Promise.all([
      new Promise<void>((resolve) => notifyWss.close(() => resolve())),
      new Promise<void>((resolve) => wss.close(() => resolve())),
    ])

    // 3) 把 debounce 窗口（1s）内尚未落库的编辑立即写入 MongoDB
    await flushAll()

    // 4) 关闭 MongoDB 连接，释放事件循环
    await closeDB()

    console.log('[server] Shutdown complete.')
    process.exit(0)
  }
  catch (err) {
    console.error('[server] Error during shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })

/* ─── Global error handlers ──────────────────────────────────── */
process.on('unhandledRejection', (reason, promise) =>
{
  console.error('[server] UNHANDLED REJECTION:', reason)
})

process.on('uncaughtException', (err) =>
{
  console.error('[server] UNCAUGHT EXCEPTION:', err)
})
