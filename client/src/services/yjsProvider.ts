import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CollabSession, UserAwareness } from '../types'
import { getToken, getYjsWsUrl } from './api'

// 用户颜色调色板（从原 Editor.jsx 移出）
const USER_COLORS = [
  '#4285f4', '#ea4335', '#34a853', '#fbbc04',
  '#ff6d00', '#aa00ff', '#00acc1', '#e91e63',
]

function getRandomColor(): string
{
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
}

function generateUserId(): string
{
  return 'user_' + Math.random().toString(36).substring(2, 9)
}

function generateUserName(): string
{
  return 'User-' + Math.floor(Math.random() * 9000 + 1000)
}

// WebSocket 地址同源派生：开发为 ws://localhost:5173/yjs（Vite 代理到 :3001），
// 生产为 ws://<host>/yjs（Express 同进程），因此同一个构建产物可部署到任意 host/port
export function createYjs(
  docId: string,
  customUser?: Partial<UserAwareness>
): CollabSession
{
  const ydoc = new Y.Doc()

  const persistence = new IndexeddbPersistence(docId, ydoc)

  const token = getToken()
  const wsUrl = getYjsWsUrl()
  // y-websocket 会把 roomName 拼到 URL 路径：${wsUrl}/${roomName}
  // 所以 token 必须附加在 roomName 的 query 参数里，否则 docId 会拼进 query string
  const roomName = token ? `${docId}?token=${token}` : docId
  const provider = new WebsocketProvider(wsUrl, roomName, ydoc)

  const user: UserAwareness = {
    id: customUser?.id || generateUserId(),
    name: customUser?.name || generateUserName(),
    color: customUser?.color || getRandomColor(),
  }

  // 设置 awareness——其他客户端通过 awareness 获取用户信息
  provider.awareness.setLocalStateField('user', {
    id: user.id,
    name: user.name,
    color: user.color,
  })

  const destroy = () =>
  {
    provider.destroy()
    persistence.destroy()
    ydoc.destroy()
  }

  return {
    doc: ydoc,
    provider,
    persistence,
    user,
    roomName: docId,
    destroy,
  }
}
