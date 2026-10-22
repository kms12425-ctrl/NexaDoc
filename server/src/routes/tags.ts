import { Router } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../auth'
import { getDB } from '../db'
import type { DocumentDoc } from '../types'

const router = Router()

router.get('/', async (req: AuthRequest, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLocaleLowerCase() : ''
  const docs = await getDB().collection<DocumentDoc>('documents').find(
    { ownerUserId: new ObjectId(req.user!.id), editorType: 'markdown', deletedAt: null },
    { projection: { tags: 1 } },
  ).toArray()
  const counts = new Map<string, { tag: string; count: number }>()
  for (const doc of docs) for (const tag of doc.tags ?? []) {
    if (query && !tag.toLocaleLowerCase().includes(query)) continue
    const key = tag.toLocaleLowerCase(); const value = counts.get(key)
    if (value) value.count += 1; else counts.set(key, { tag, count: 1 })
  }
  res.json([...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, 50))
})

export default router
