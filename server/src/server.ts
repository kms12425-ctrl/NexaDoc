import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'

// y-websocket/bin/utils 没有 TypeScript 类型声明，用 require 避免 TS 报错
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils')

import { connectDB, getDB } from './db'
import { mongoPersistence } from './persistence'
import { register, login, requireAuth, AuthRequest } from './auth'
import { addConnection, removeConnection } from './notifications'
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
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

/* ── Auth routes ── */
app.post('/api/auth/register', register)
app.post('/api/auth/login', login)
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user })
})

/* ── REST API routes ── */
app.use('/api/documents', requireAuth, documentsRouter)
app.use('/api/documents', requireAuth, sharingRouter)
app.use('/api/documents', requireAuth, commentsRouter)
app.use('/api/documents', requireAuth, snapshotsRouter)

/* ── Global error handler ── */
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error('[api] ERROR:', err.message, err.stack)
  res.status(500).json({ error: 'Internal server error', detail: err.message })
})

/* ─── Yjs WebSocket server (noServer mode) ────────────────────── */
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true })

// 注册 MongoDB 持久化层（y-websocket v2 用 setPersistence 全局设置）
setPersistence(mongoPersistence)

wss.on('connection', (ws, req) => {
  // 从 URL 提取 docName：/yjs/<docId> → <docId>
  const pathname = new URL(req.url || '/', 'http://x').pathname
  const docName = pathname.replace(/^\/yjs\/?/, '')

  setupWSConnection(ws, req, { docName })
})

// ── 通知 WebSocket Server（用户级实时推送）──
const notifyWss = new WebSocketServer({ noServer: true })

notifyWss.on('connection', (ws: WebSocket, userId: string) => {
  addConnection(userId, ws)

  ws.on('close', () => {
    removeConnection(userId, ws)
  })

  ws.on('error', (err) => {
    console.error(`[notifications] WS error for user ${userId}:`, err)
    removeConnection(userId, ws)
  })

  // 发送确认消息
  ws.send(JSON.stringify({ type: 'connected', userId }))
})

const server = http.createServer(app)

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', 'http://x')
  const pathname = url.pathname

  // ── 路由 1: /ws/notifications — 用户级通知 ──
  if (pathname === '/ws/notifications') {
    const token = url.searchParams.get('token')
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: string }
      notifyWss.handleUpgrade(request, socket, head, (ws) => {
        notifyWss.emit('connection', ws, payload.id)
      })
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
    return
  }

  // ── 路由 2: /yjs/<docId> — 文档级 CRDT 同步 ──
  if (pathname.startsWith('/yjs')) {
    const token = url.searchParams.get('token')
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    try {
      jwt.verify(token, JWT_SECRET)
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
    return
  }

  // ── 未知路径 ──
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
  socket.destroy()
})

/* ─── Start server ────────────────────────────────────────────── */
async function start(): Promise<void> {
  await connectDB()
  server.listen(PORT, () => {
    console.log(`[server] Running on http://localhost:${PORT}`)
    console.log(`[server] Accepting connections from: ${CLIENT_ORIGIN}`)
    console.log(`[server] Yjs WebSocket on path: /yjs/<docName>`)
  })
}

start().catch((err) => {
  console.error('[server] Failed to start:', err)
  process.exit(1)
})

/* ─── Graceful shutdown ───────────────────────────────────────── */
function shutdown(signal: string): void {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully…`)
  server.close(() => {
    console.log('[server] HTTP server closed.')
    process.exit(0)
  })
  setTimeout(() => {
    console.error('[server] Forced exit after timeout.')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

/* ─── Global error handlers ──────────────────────────────────── */
process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] UNHANDLED REJECTION:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('[server] UNCAUGHT EXCEPTION:', err)
})
