import { ObjectId } from 'mongodb'
import { getDB } from './db'
import { Role, LinkReach } from './types'
import type { DocumentAccessDoc, DocumentDoc } from './types'
export { Role, LinkReach }

// 权限层级：owner > admin > editor > commenter > reader
const ROLE_PRIORITY: Record<Role, number> = {
  [Role.OWNER]: 5,
  [Role.ADMIN]: 4,
  [Role.EDITOR]: 3,
  [Role.COMMENTER]: 2,
  [Role.READER]: 1,
}

/**
 * 能力契约：根据用户在文档上的角色返回能力集合
 * 根据用户在文档上的角色返回能力契约。
 * 前端 UI 直接消费这些布尔值决定按钮/操作的显示与隐藏。
 */
export function getAbilities(role: Role | null):
  {
    canView: boolean
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
    canComment: boolean
    canViewHistory: boolean
  }
{
  if (!role) {
    return {
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canComment: false,
      canViewHistory: false,
    }
  }

  const isOwner = role === Role.OWNER
  const isAdmin = role === Role.ADMIN
  const isEditor = role === Role.EDITOR
  const isCommenter = role === Role.COMMENTER

  return {
    canView: true,
    canEdit: isOwner || isAdmin || isEditor,
    canDelete: isOwner || isAdmin,
    canShare: isOwner || isAdmin,
    canComment: isOwner || isAdmin || isEditor || isCommenter,
    canViewHistory: isOwner || isAdmin || isEditor,
  }
}

/** 检查某角色是否能操作目标角色（用于权限委派） */
export function canManageRole(role: Role, target: Role): boolean
{
  return ROLE_PRIORITY[role] >= ROLE_PRIORITY[target]
}

/**
 * 链接访问的默认角色（默认 `link_reach = authenticated`）。
 * 即：任何拿到链接的登录用户，在没有被显式邀请时，默认获得该角色。
 * 想收紧成「只有被邀请者能访问」，把这里改成 `null` 即可。
 */
export const DEFAULT_LINK_ROLE: Role | null = Role.EDITOR

export interface ResolvedAccess
{
  doc: DocumentDoc
  /** null 表示该用户对该文档没有任何角色（仅在收紧 DEFAULT_LINK_ROLE 后出现） */
  role: Role | null
  abilities: ReturnType<typeof getAbilities>
}

/**
 * 唯一的权限判定入口。
 *
 * REST（文档元数据 / 改标题 / 快照）与 WebSocket（`/yjs` 文档同步）都必须走这里，
 * 否则会出现「REST 说这个用户可以编辑、但 WS 拒绝他同步」之类的不一致
 * ——表现为界面能打开、能打字，内容却永远同步不出去。
 *
 * 返回 `null` 表示文档不存在（或已被软删除）。
 */
export async function resolveAccess(
  docId: string,
  userId: string | null
): Promise<ResolvedAccess | null>
{
  const db = getDB()
  const doc = await db
    .collection<DocumentDoc>('documents')
    .findOne({ docId, deletedAt: null })
  if (!doc) return null

  let role: Role | null = null

  if (userId && doc.ownerUserId?.toString() === userId) {
    role = Role.OWNER
  } else {
    if (userId && ObjectId.isValid(userId)) {
      const access = await db.collection<DocumentAccessDoc>('document_access').findOne({
        documentId: doc._id!,
        userId: new ObjectId(userId),
      })
      if (access) role = access.role as Role
    }
    // 未被显式邀请：登录用户按链接访问默认角色放行；未登录用户一律拒绝
    if (!role) role = userId ? DEFAULT_LINK_ROLE : null
  }

  return { doc, role, abilities: getAbilities(role) }
}
