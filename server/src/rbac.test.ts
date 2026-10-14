import { describe, it, expect } from 'vitest'
import { getAbilities, canManageRole, resolveAccess, Role, DEFAULT_LINK_ROLE } from './rbac'
import { getDB } from './db'
import { ObjectId } from 'mongodb'
import type { DocumentDoc, DocumentAccessDoc } from './types'

// ── getAbilities: 全角色矩阵 ──────────────────────────────────
describe('getAbilities', () => {
  const cases: Array<{
    role: Role | null
    canView: boolean
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
    canComment: boolean
    canViewHistory: boolean
  }> = [
    { role: null,           canView: true,  canEdit: false, canDelete: false, canShare: false, canComment: false, canViewHistory: false },
    { role: Role.READER,    canView: true,  canEdit: false, canDelete: false, canShare: false, canComment: false, canViewHistory: false },
    { role: Role.COMMENTER, canView: true,  canEdit: false, canDelete: false, canShare: false, canComment: true,  canViewHistory: false },
    { role: Role.EDITOR,    canView: true,  canEdit: true,  canDelete: false, canShare: false, canComment: true,  canViewHistory: true  },
    { role: Role.ADMIN,     canView: true,  canEdit: true,  canDelete: true,  canShare: true,  canComment: true,  canViewHistory: true  },
    { role: Role.OWNER,     canView: true,  canEdit: true,  canDelete: true,  canShare: true,  canComment: true,  canViewHistory: true  },
  ]

  it.each(cases)(
    'role=$role returns correct abilities',
    ({ role, canView, canEdit, canDelete, canShare, canComment, canViewHistory }) => {
      const abilities = getAbilities(role)
      expect(abilities).toEqual({
        canView,
        canEdit,
        canDelete,
        canShare,
        canComment,
        canViewHistory,
      })
    }
  )
})

// ── canManageRole ──────────────────────────────────────────────
describe('canManageRole', () => {
  const cases: Array<{ actor: Role; target: Role; expected: boolean }> = [
    { actor: Role.OWNER,    target: Role.ADMIN,     expected: true  },
    { actor: Role.ADMIN,    target: Role.EDITOR,    expected: true  },
    { actor: Role.EDITOR,   target: Role.COMMENTER, expected: true  },
    { actor: Role.COMMENTER, target: Role.READER,   expected: true  },
    { actor: Role.READER,   target: Role.EDITOR,    expected: false },
    { actor: Role.EDITOR,   target: Role.ADMIN,     expected: false },
    { actor: Role.COMMENTER, target: Role.COMMENTER, expected: true },
  ]

  it.each(cases)(
    'canManageRole($actor, $target) → $expected',
    ({ actor, target, expected }) => {
      expect(canManageRole(actor, target)).toBe(expected)
    }
  )
})

// ── DEFAULT_LINK_ROLE ──────────────────────────────────────────
describe('DEFAULT_LINK_ROLE', () => {
  it('defaults to EDITOR', () => {
    expect(DEFAULT_LINK_ROLE).toBe(Role.EDITOR)
  })
})

// ── resolveAccess: 集成测试（需内存 DB） ──────────────────────
describe('resolveAccess', () => {
  let docId: string
  let docObjectId: ObjectId
  let ownerUserId: ObjectId
  let editorUserId: ObjectId
  let readerUserId: ObjectId
  let otherUserId: ObjectId

  async function insertDoc(overrides: Partial<DocumentDoc> = {}): Promise<{ docId: string; docObjectId: ObjectId; ownerUserId: ObjectId }> {
    const db = getDB()
    const owner = new ObjectId()
    const did = `test-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const result = await db.collection<DocumentDoc>('documents').insertOne({
      docId: did,
      title: 'Test Doc',
      ownerUserId: owner,
      crdtState: Buffer.alloc(0),
      crdtStateSize: 0,
      updateCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    })
    return { docId: did, docObjectId: result.insertedId, ownerUserId: owner }
  }

  async function insertAccess(documentId: ObjectId, userId: ObjectId, role: Role): Promise<void> {
    const db = getDB()
    await db.collection<DocumentAccessDoc>('document_access').insertOne({
      documentId,
      userId,
      role,
      invitedAt: new Date(),
      acceptedAt: new Date(),
    })
  }

  it('owner accessing own document → role=OWNER', async () => {
    const { docId, ownerUserId } = await insertDoc()
    const result = await resolveAccess(docId, ownerUserId.toString())
    expect(result).not.toBeNull()
    expect(result!.role).toBe(Role.OWNER)
    expect(result!.abilities.canEdit).toBe(true)
    expect(result!.abilities.canDelete).toBe(true)
  })

  it('invited editor → role=EDITOR', async () => {
    const { docId, docObjectId, ownerUserId } = await insertDoc()
    const editor = new ObjectId()
    await insertAccess(docObjectId, editor, Role.EDITOR)
    const result = await resolveAccess(docId, editor.toString())
    expect(result!.role).toBe(Role.EDITOR)
    expect(result!.abilities.canEdit).toBe(true)
    expect(result!.abilities.canDelete).toBe(false)
  })

  it('invited reader → role=READER', async () => {
    const { docId, docObjectId } = await insertDoc()
    const reader = new ObjectId()
    await insertAccess(docObjectId, reader, Role.READER)
    const result = await resolveAccess(docId, reader.toString())
    expect(result!.role).toBe(Role.READER)
    expect(result!.abilities.canEdit).toBe(false)
  })

  it('logged-in user without invite → DEFAULT_LINK_ROLE (EDITOR)', async () => {
    const { docId } = await insertDoc()
    const randomUser = new ObjectId()
    const result = await resolveAccess(docId, randomUser.toString())
    expect(result!.role).toBe(DEFAULT_LINK_ROLE)
    expect(result!.abilities.canEdit).toBe(true)
  })

  it('anonymous user (userId=null) → role=null', async () => {
    const { docId } = await insertDoc()
    const result = await resolveAccess(docId, null)
    expect(result!.role).toBeNull()
    expect(result!.abilities.canEdit).toBe(false)
  })

  it('nonexistent document → null', async () => {
    const result = await resolveAccess('does-not-exist', null)
    expect(result).toBeNull()
  })

  it('soft-deleted document → null', async () => {
    const { docId } = await insertDoc({ deletedAt: new Date() })
    const result = await resolveAccess(docId, null)
    expect(result).toBeNull()
  })
})
