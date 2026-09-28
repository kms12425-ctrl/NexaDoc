import type * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'
import type { IndexeddbPersistence } from 'y-indexeddb'

// 用户 awareness 状态（用于 Yjs awareness 协议）
export interface UserAwareness {
  id: string
  name: string
  color: string
}

// 协作会话——封装 Yjs 三件套
export interface CollabSession {
  doc: Y.Doc
  provider: WebsocketProvider
  persistence: IndexeddbPersistence
  user: UserAwareness
  roomName: string
  destroy: () => void
}

// 文档元数据（localStorage 和后续 API 共用）
export interface DocumentMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  // ── 预留字段（来自 docs 项目的架构借鉴）──
  parentId?: string | null         // 文档树结构：父文档 ID（阶段六启用）
  deletedAt?: number | null        // 软删除时间戳（阶段六启用）
  abilities?: DocumentAbilities    // 当前用户对该文档的能力契约（阶段四启用）
}

// 连接状态
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

// Awareness 中其他用户的状态
export interface RemoteUserState {
  user: UserAwareness
  selection?: { from: number; to: number } | null
  docTitle?: string
}

// ── 预留：文档能力契约（来自 docs 项目的 get_abilities() 模式）──
// 阶段四实现 RBAC 权限系统时，后端在文档序列化时返回这些布尔值，
// 前端 UI 直接消费决定按钮/操作的显示与隐藏。
// 阶段一所有能力默认 true（单用户无权限控制）。
export interface DocumentAbilities {
  canView?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canShare?: boolean
  canComment?: boolean
  canViewHistory?: boolean
  // 后续可扩展更多能力字段...
}
