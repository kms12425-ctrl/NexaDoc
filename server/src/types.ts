import type { ObjectId } from 'mongodb'

// ── RBAC 角色 ──
export const Role = {
  READER: 'reader',
  COMMENTER: 'commenter',
  EDITOR: 'editor',
  ADMIN: 'administrator',
  OWNER: 'owner',
} as const
export type Role = typeof Role[keyof typeof Role]

// ── 链接可见性 ──
export const LinkReach = {
  RESTRICTED: 'restricted',
  AUTHENTICATED: 'authenticated',
  PUBLIC: 'public',
} as const
export type LinkReach = typeof LinkReach[keyof typeof LinkReach]

// ── 用户文档 ──
export interface UserDoc {
  _id?: ObjectId
  username: string
  email?: string
  passwordHash: string
  displayName: string
  avatarColor: string
  createdAt: Date
  updatedAt: Date
}

// ── 文档 ──
export interface DocumentDoc {
  _id?: ObjectId
  docId: string               // Yjs room name，用作 WebSocket 路由 key
  title: string
  ownerUserId: ObjectId | null
  parentId?: string | null        // 文档树结构（阶段六启用）
  deletedAt?: Date | null         // 软删除时间戳
  crdtState: Buffer              // Y.encodeStateAsUpdate(doc) 二进制
  crdtStateSize: number
  updateCount: number
  createdAt: Date
  updatedAt: Date
}

// ── 文档访问权限 ──
export interface DocumentAccessDoc {
  _id?: ObjectId
  documentId: ObjectId
  userId: ObjectId
  role: Role
  invitedAt: Date
  acceptedAt: Date | null
}

// ── 版本快照 ──
export interface SnapshotDoc {
  _id?: ObjectId
  documentId: ObjectId
  name: string
  crdtState: Buffer
  crdtStateSize: number
  authorUserId: ObjectId | null
  authorName: string
  preview: string
  createdAt: Date
}

// ── 评论 ──
export interface CommentDoc {
  _id?: ObjectId
  documentId: ObjectId
  userId: ObjectId
  authorName: string
  body: string
  resolved: boolean
  createdAt: Date
  updatedAt: Date
}
