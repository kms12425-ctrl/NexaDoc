import { Router, Request, Response } from 'express'
import { ObjectId, type Filter } from 'mongodb'
import { getDB } from '../db'
import { AuthRequest } from '../auth'
import { getAbilities, getDocumentAbilities, resolveAccess, Role } from '../rbac'
import { generateDocId } from '../docId'
import type { DocumentAccessDoc, DocumentDoc } from '../types'
import { MAX_MARKDOWN_BYTES, normalizeTags, serializeDocument } from '../markdown/metadata'
import { initialSearchText } from '../markdown/initialSearchText'
import { restrictMarkdownRoutes } from '../markdown/restrictRoutes'

const router = Router()
router.use('/:docId', restrictMarkdownRoutes)

/**
 * GET /api/documents — 列出当前用户的文档（排除软删除）
 */
router.get('/', async (req: AuthRequest, res: Response) =>
{
  const db = getDB()
  const userId = new ObjectId(req.user!.id)
  const type = req.query.type ?? 'all'
  if ((type !== 'rich' && type !== 'markdown' && type !== 'all') || Object.keys(req.query).some((key) => key.startsWith('type['))) {
    res.status(400).json({ error: 'Invalid document type' })
    return
  }
  const typeFilter: Filter<DocumentDoc> = type === 'markdown'
    ? { editorType: 'markdown' }
    : type === 'rich' ? { editorType: { $ne: 'markdown' } } : {}
  const listProjection = { crdtState: 0, markdown: 0, searchText: 0, outgoingLinks: 0 }

  // ── 1. Owned documents ──
  const ownedDocs = await db
    .collection<DocumentDoc>('documents')
    .find(
      { ownerUserId: userId, deletedAt: null, ...typeFilter },
      { projection: listProjection }
    )
    .sort({ updatedAt: -1 })
    .toArray()

  const ownedResult = ownedDocs.map((d) => ({
    ...serializeDocument(d),
    abilities: getDocumentAbilities(d, Role.OWNER),
    shared: false,
    previewHtml: d.previewHtml || '',
  }))

  // ── 2. Shared documents ──
  const accessRecords = await db
    .collection<DocumentAccessDoc>('document_access')
    .find({ userId })
    .toArray()

  const docIds = accessRecords.map((a) => a.documentId)
  const roleMap = new Map(
    accessRecords.map((a) => [a.documentId.toString(), a.role as Role])
  )

  const sharedDocs = type !== 'markdown' && docIds.length > 0
    ? await db
      .collection<DocumentDoc>('documents')
      .find(
        { _id: { $in: docIds }, deletedAt: null, editorType: { $ne: 'markdown' } },
        { projection: listProjection }
      )
      .sort({ updatedAt: -1 })
      .toArray()
    : []

  const sharedResult = sharedDocs.map((d) => ({
    ...serializeDocument(d),
    abilities: getDocumentAbilities(d, roleMap.get(d._id!.toString()) || null),
    shared: true,
    previewHtml: d.previewHtml || '',
  }))

  res.json([...ownedResult, ...sharedResult].sort((a, b) => b.updatedAt - a.updatedAt))
})

/**
 * POST /api/documents — 创建文档，ownerUserId 设为当前用户
 */
router.post('/', async (req: AuthRequest, res: Response) =>
{
  const db = getDB()
  const body = req.body ?? {}
  const editorType = body.editorType === undefined ? 'rich' : body.editorType
  if (editorType !== 'rich' && editorType !== 'markdown') {
    res.status(400).json({ error: 'Invalid editorType' })
    return
  }
  if (body.name !== undefined && typeof body.name !== 'string') {
    res.status(400).json({ error: 'Name must be a string' })
    return
  }
  const name = body.name?.trim() || 'Untitled Document'
  if (editorType === 'markdown' && body.markdown !== undefined && typeof body.markdown !== 'string') {
    res.status(400).json({ error: 'Markdown content must be a string' })
    return
  }
  const markdown = editorType === 'markdown' ? body.markdown ?? '' : undefined
  if (markdown !== undefined && Buffer.byteLength(markdown, 'utf8') > MAX_MARKDOWN_BYTES) {
    res.status(400).json({ error: 'Markdown content too large' })
    return
  }
  // docId 必须 ASCII 安全（要拼进 WebSocket 路径），见 docId.ts 的说明
  const docId = generateDocId(name)
  const now = new Date()

  const doc: DocumentDoc = {
    docId,
    title: name,
    ownerUserId: new ObjectId(req.user!.id),
    deletedAt: null,
    editorType,
    tags: normalizeTags(body.tags),
    revision: 0,
    ...(markdown !== undefined ? {
      markdown, searchText: initialSearchText(markdown), outgoingLinks: [], markdownIndexedAt: now,
    } : {}),
    crdtState: Buffer.alloc(0),
    crdtStateSize: 0,
    updateCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  await db.collection<DocumentDoc>('documents').insertOne(doc)

  res.status(201).json({
    ...serializeDocument(doc),
    abilities: getDocumentAbilities(doc, Role.OWNER),
  })
})

/**
 * GET /api/documents/:docId/metadata — 获取文档元数据 + 权限
 */
router.get('/:docId/metadata', async (req: AuthRequest, res: Response) =>
{
  const access = await resolveAccess(req.params.docId as string, req.user!.id)
  if (!access) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const { doc, abilities } = access
  res.json({
    ...serializeDocument(doc),
    abilities,
  })
})

/**
 * PATCH /api/documents/:docId/metadata — 更新标题（需 canEdit）
 */
router.patch('/:docId/metadata', async (req: AuthRequest, res: Response) =>
{
  const db = getDB()
  const access = await resolveAccess(req.params.docId as string, req.user!.id)
  if (!access) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  if (!access.abilities.canEdit) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body) || (!Object.hasOwn(body, 'title') && !Object.hasOwn(body, 'tags'))) {
    res.status(400).json({ error: 'Provide title or tags' }); return
  }
  const fields: Partial<DocumentDoc> = {}
  if (Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim() || (access.doc.editorType === 'markdown' && body.title.trim().length > 120)) {
      res.status(400).json({ error: 'Title must be non-empty (Markdown: max 120 characters)' }); return
    }
    fields.title = body.title.trim()
  }
  if (Object.hasOwn(body, 'tags')) {
    if (!Array.isArray(body.tags) || body.tags.some((tag: unknown) => typeof tag !== 'string')) {
      res.status(400).json({ error: 'Tags must be an array of strings' }); return
    }
    const cleaned = body.tags.map((tag: string) => tag.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim())
    if (cleaned.some((tag: string) => !tag || tag.length > 30)) {
      res.status(400).json({ error: 'Tags must contain 1–30 characters' }); return
    }
    if (new Set(cleaned.map((tag: string) => tag.toLocaleLowerCase())).size > 20) {
      res.status(400).json({ error: 'Too many tags (max 20)' }); return
    }
    fields.tags = normalizeTags(cleaned)
  }
  fields.updatedAt = new Date(Math.max(Date.now(), access.doc.updatedAt.getTime() + 1))
  const updated = await db.collection<DocumentDoc>('documents').findOneAndUpdate(
    { _id: access.doc._id, deletedAt: null, ...(access.doc.editorType === 'markdown' ? { ownerUserId: new ObjectId(req.user!.id) } : {}) },
    { $set: fields }, { returnDocument: 'after' },
  )
  if (!updated) { res.status(404).json({ error: 'Document not found' }); return }
  // Metadata never changes the body revision or its search/link/CRDT indexes.
  res.json({ status: 'ok', ...serializeDocument(updated) })
})

/**
 * DELETE /api/documents/:docId — 软删除（需 canDelete）
 */
router.delete('/:docId', async (req: AuthRequest, res: Response) =>
{
  const db = getDB()
  const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: req.params.docId })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const isOwner = doc.ownerUserId?.toString() === req.user!.id
  const access = await db.collection<DocumentAccessDoc>('document_access').findOne({
    documentId: doc._id!,
    userId: new ObjectId(req.user!.id),
  })
  const role: Role = isOwner ? Role.OWNER : (access?.role as Role) || Role.EDITOR
  const abilities = getAbilities(role)
  if (!abilities.canDelete) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  await db.collection<DocumentDoc>('documents').updateOne(
    { docId: req.params.docId },
    { $set: { deletedAt: new Date() } }
  )
  res.json({ status: 'ok' })
})

/**
 * PUT /api/documents/:docId/preview — 更新文档预览 HTML（需 canView）
 */
router.put('/:docId/preview', async (req: AuthRequest, res: Response) =>
{
  const db = getDB()
  const access = await resolveAccess(req.params.docId as string, req.user!.id)
  if (!access) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  if (!access.abilities.canView) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  const preview = typeof req.body.preview === 'string' ? req.body.preview : ''
  // 限制预览 HTML 体积（100KB）
  if (Buffer.byteLength(preview, 'utf8') > 100_000) {
    res.status(413).json({ error: 'Preview HTML too large' })
    return
  }

  await db.collection<DocumentDoc>('documents').updateOne(
    { docId: req.params.docId },
    { $set: { previewHtml: preview } }
  )
  res.json({ status: 'ok' })
})

export default router
