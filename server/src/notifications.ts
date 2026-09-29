import type { WebSocket } from 'ws'

/**
 * 内存级 WebSocket 通知中心
 *
 * 数据结构: Map<userId, Set<WebSocket>>
 * - 用户打开 DocsPage 时建立 WS 连接，注册到这里
 * - 服务端调用 notifyUser(userId, event) 推送消息
 * - 用户关闭页面时连接自动断开，从 Map 中移除
 *
 * 不持久化——服务重启后连接重建即可，通知不补发。
 */
const connections = new Map<string, Set<WebSocket>>()

/** 注册一个用户的 WebSocket 连接 */
export function addConnection(userId: string, ws: WebSocket): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set())
  }
  connections.get(userId)!.add(ws)
  console.log(`[notifications] User ${userId} connected (${connections.get(userId)!.size} connection(s))`)
}

/** 移除一个用户的 WebSocket 连接 */
export function removeConnection(userId: string, ws: WebSocket): void {
  const set = connections.get(userId)
  if (!set) return
  set.delete(ws)
  if (set.size === 0) {
    connections.delete(userId)
  }
  console.log(`[notifications] User ${userId} disconnected (${set.size} connection(s) remaining)`)
}

/** 向某用户的所有连接推送一条事件 */
export function notifyUser(userId: string, event: object): void {
  const set = connections.get(userId)
  if (!set || set.size === 0) {
    console.log(`[notifications] User ${userId} offline, skipping notification`)
    return
  }
  const message = JSON.stringify(event)
  let sent = 0
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message)
      sent++
    }
  }
  console.log(`[notifications] Notified user ${userId} (${sent}/${set.size} connections)`)
}

/** 检查用户是否在线 */
export function isUserOnline(userId: string): boolean {
  const set = connections.get(userId)
  return !!set && set.size > 0
}
