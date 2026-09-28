import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CollabSession, UserAwareness } from '../types'

// 用户颜色调色板（从原 Editor.jsx 移出）
const USER_COLORS = [
  '#4285f4', '#ea4335', '#34a853', '#fbbc04',
  '#ff6d00', '#aa00ff', '#00acc1', '#e91e63',
]

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
}

function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substring(2, 9)
}

function generateUserName(): string {
  return 'User-' + Math.floor(Math.random() * 9000 + 1000)
}

// 开发环境通过 Vite 代理连接（ws://localhost:5173/yjs/<docId> → ws://localhost:3001/yjs/<docId>）
// 生产环境直连后端
const WS_URL = import.meta.env.VITE_YJS_URL || 'ws://localhost:5173/yjs'

export function createYjs(
  docId: string,
  customUser?: Partial<UserAwareness>
): CollabSession {
  const ydoc = new Y.Doc()

  const persistence = new IndexeddbPersistence(docId, ydoc)

  const provider = new WebsocketProvider(WS_URL, docId, ydoc)

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

  const destroy = () => {
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
