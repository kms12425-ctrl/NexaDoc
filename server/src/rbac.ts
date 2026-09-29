import { Role, LinkReach } from './types'
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
 * 根据用户在文档上的角色返回能力契约
 * 根据用户在文档上的角色返回能力契约。
 * 前端 UI 直接消费这些布尔值决定按钮/操作的显示与隐藏。
 */
export function getAbilities(role: Role | null): {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canShare: boolean
  canComment: boolean
  canViewHistory: boolean
} {
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
export function canManageRole(role: Role, target: Role): boolean {
  return ROLE_PRIORITY[role] >= ROLE_PRIORITY[target]
}
