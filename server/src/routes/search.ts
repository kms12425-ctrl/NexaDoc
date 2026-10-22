import { Router } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../auth'
import { getDB } from '../db'
import type { DocumentDoc } from '../types'
import { serializeDocument } from '../markdown/metadata'

const router = Router()
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

router.get('/', async (req: AuthRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : ''
  const type = req.query.type
  if (type !== undefined && type !== 'markdown') { res.status(400).json({ error: 'Only Markdown search is supported' }); return }
  const requested = Number(req.query.limit); const limit = Number.isSafeInteger(requested) ? Math.min(Math.max(requested, 1), 50) : 30
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5).map(escape)
  const conditions = terms.map((term) => ({ $or: [{ title: { $regex: term, $options: 'i' } }, { tags: { $regex: term, $options: 'i' } }, { searchText: { $regex: term, $options: 'i' } }] }))
  const docs = await getDB().collection<DocumentDoc>('documents').find({ ownerUserId: new ObjectId(req.user!.id), editorType: 'markdown', deletedAt: null, ...(tag ? { tags: { $regex: `^${escape(tag)}$`, $options: 'i' } } : {}), ...(conditions.length ? { $and: conditions } : {}) }).sort({ updatedAt: -1 }).limit(100).toArray()
  const lower = q.toLocaleLowerCase()
  const scored = docs.map((doc) => {
    const title = doc.title.toLocaleLowerCase(); const text = (doc.searchText ?? '').toLocaleLowerCase()
    const score = (title.includes(lower) ? 100 : 0) + ((doc.tags ?? []).some((item) => item.toLocaleLowerCase().includes(lower)) ? 50 : 0) + (text.includes(lower) ? 10 : 0)
    const at = lower ? text.indexOf(lower) : 0; const snippet = text.slice(Math.max(0, at - 40), at + Math.max(lower.length, 1) + 40)
    return { ...serializeDocument(doc), shared: false, abilities: { canView: true, canEdit: true, canDelete: true, canShare: false, canComment: false, canViewHistory: false }, snippet: `${at > 40 ? '…' : ''}${snippet}${at + lower.length + 40 < text.length ? '…' : ''}`, highlights: at >= 0 && lower ? [{ start: Math.max(0, at - 40), length: lower.length }] : [], score }
  }).sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt).slice(0, limit).map(({ score: _score, ...item }) => item)
  res.json(scored)
})

export default router
