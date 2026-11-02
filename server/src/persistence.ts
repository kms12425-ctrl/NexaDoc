import * as Y from 'yjs'
import { getDB } from './db'
import type { DocumentDoc } from './types'
import { analyzeMarkdown } from './markdown/analyze'
import { resolveLinkTargets } from './markdown/resolveLinkTargets'

const DEBOUNCE_MS = 1000
const timers = new Map<string, NodeJS.Timeout>()
// 记录已绑定的文档，供优雅退出时立即回写（否则 debounce 窗口内的更新会丢）
const boundDocs = new Map<string, Y.Doc>()
const markdownWriters = new WeakMap<Y.Doc, string>()
export function setMarkdownWriter(doc: Y.Doc, userId: string) { markdownWriters.set(doc, userId) }
const markdownEpochs = new WeakMap<Y.Doc, number>()
// 退出中标志：此时 y-websocket 断连触发的 writeState 交给 flushAll 统一落库，避免与 closeDB 竞态
let closing = false

/** 进入优雅退出状态（应在断开 WS 连接之前调用） */
export function beginShutdown(): void
{
  closing = true
}

/**
 * 把从 MongoDB 读回的二进制值统一成 Buffer。
 *
 * 驱动读回 BSON Binary 时给的是 Binary 对象——它**没有 `length`**（只有 `.buffer`），
 * 直接取 `.length` 会得到 undefined（快照的 crdtStateSize 字段就是这么丢的）；
 * 而如果值恰好是 Buffer，`new Uint8Array(buf.buffer)` 又会暴露整个内存池。
 * 所以凡是要用 crdtState 的地方都先过这个函数。
 */
export function toBuffer(value: unknown): Buffer
{
  if (!value) return Buffer.alloc(0)
  if (Buffer.isBuffer(value)) return Buffer.from(value)

  const inner = (value as { buffer?: unknown }).buffer
  if (inner instanceof Uint8Array) return Buffer.from(inner)
  if (inner instanceof ArrayBuffer) return Buffer.from(inner)

  return Buffer.alloc(0)
}

/**
 * Yjs 持久化层——参考 HocusPocus 的 onLoadDocument/onChange 模式设计。
 *
 * y-websocket v2 通过 setPersistence() 全局注册 persistence 对象，
 * 在 getYDoc() 创建新文档时自动调用 bindState，
 * 在 closeConn()（所有连接断开）时自动调用 writeState。
 *
 * bindState/writeState 的第二个参数是 WSSharedDoc（继承自 Y.Doc）。
 */
export const mongoPersistence = {
  async bindState(docName: string, ydoc: Y.Doc): Promise<void>
  {
    console.log(`[persistence] bindState: ${docName}`)
    try {
      const db = getDB()
      let existing: DocumentDoc | null = await db.collection<DocumentDoc>('documents').findOne({ docId: docName })
      if (existing?.editorType === 'markdown') {
        existing = await (await import('./markdown/crdt')).ensureMarkdownState(docName)
        markdownEpochs.set(ydoc, existing.markdownEpoch ?? 0)
      }
      const state = toBuffer(existing?.crdtState)

      if (state.length > 0) {
        // 从 MongoDB 恢复 CRDT 状态到内存
        Y.applyUpdate(ydoc, new Uint8Array(state))
        console.log(`[persistence] Restored state for ${docName} (${state.length} bytes)`)
      } else if (!existing) {
        // 新文档——创建 MongoDB 记录
        await db.collection<DocumentDoc>('documents').insertOne({
          docId: docName,
          title: 'Untitled Document',
          ownerUserId: null,
          crdtState: Buffer.alloc(0),
          crdtStateSize: 0,
          updateCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        console.log(`[persistence] Created new doc record for ${docName}`)
      }

      // 监听更新，debounce 写入 MongoDB
      ydoc.on('update', () =>
      {
        scheduleSave(docName, ydoc)
      })
      boundDocs.set(docName, ydoc)
      ydoc.on('destroy', () => {
        if (boundDocs.get(docName) === ydoc) {
          boundDocs.delete(docName)
          const timer = timers.get(docName); if (timer) clearTimeout(timer)
          timers.delete(docName)
        }
      })
    } catch (err) {
      console.error(`[persistence] bindState ERROR for ${docName}:`, err)
      throw err
    }
  },

  async writeState(docName: string, ydoc: Y.Doc): Promise<void>
  {
    if (closing) {
      // 退出流程中，flushAll() 会统一回写，这里跳过以免写入已被关闭的连接
      console.log(`[persistence] writeState skipped (shutting down): ${docName}`)
      return
    }
    console.log(`[persistence] writeState: ${docName}`)
    const t = timers.get(docName)
    if (t) {
      clearTimeout(t)
      timers.delete(docName)
    }
    try {
      await saveImmediate(docName, ydoc)
      console.log(`[persistence] writeState done: ${docName}`)
    } catch (err) {
      console.error(`[persistence] writeState ERROR for ${docName}:`, err)
      throw err
    }
  },
}

/**
 * 优雅退出：清掉 debounce 计时器，把所有已绑定文档立即回写 MongoDB。
 * 否则服务在 debounce 窗口（1s）内被终止会丢掉最后的编辑。
 */
export async function flushAll(): Promise<void>
{
  const names = [...boundDocs.keys()]
  for (const name of names) {
    const t = timers.get(name)
    if (t) {
      clearTimeout(t)
      timers.delete(name)
    }
  }

  await Promise.all(
    names.map(async (name) =>
    {
      const ydoc = boundDocs.get(name)
      if (!ydoc) return
      try {
        await saveImmediate(name, ydoc)
      }
      catch (err) {
        console.error(`[persistence] flushAll ERROR for ${name}:`, err)
      }
    })
  )
  console.log(`[persistence] flushed ${names.length} document(s)`)
}

function scheduleSave(docName: string, ydoc: Y.Doc): void
{
  const existing = timers.get(docName)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() =>
  {
    void saveImmediate(docName, ydoc).catch((error) => console.error('[persistence] save failed', error))
    timers.delete(docName)
  }, DEBOUNCE_MS)
  timers.set(docName, timer)
}

const writes = new Map<string, Promise<void>>()
async function saveImmediate(docName: string, ydoc: Y.Doc): Promise<void> {
  const operation = (writes.get(docName) ?? Promise.resolve()).catch(() => {}).then(() => persistDocument(docName, ydoc))
  writes.set(docName, operation)
  try { await operation } finally { if (writes.get(docName) === operation) writes.delete(docName) }
}

async function persistDocument(docName: string, ydoc: Y.Doc): Promise<void>
{
  const db = getDB()
  const state = Y.encodeStateAsUpdate(ydoc)
  const markdownSnapshot = ydoc.getText('markdown').toString()
  const writer = markdownWriters.get(ydoc)
  const buf = Buffer.from(state)

  const existing = await db.collection<DocumentDoc>('documents').findOne({ docId: docName })
  if (existing?.editorType === 'markdown') {
    const epoch = markdownEpochs.get(ydoc)
    if (epoch !== undefined && epoch !== (existing.markdownEpoch ?? 0)) return
    const markdown = markdownSnapshot
    const changed = markdown !== (existing.markdown ?? '')
    const analysis = changed ? analyzeMarkdown(markdown) : null
    const outgoingLinks = analysis ? await resolveLinkTargets(analysis.outgoingLinks, writer ?? existing.ownerUserId!.toString(), existing.outgoingLinks) : existing.outgoingLinks
    await db.collection<DocumentDoc>('documents').updateOne({ _id: existing._id, deletedAt: null, markdownEpoch: existing.markdownEpoch ?? 0 }, {
      $set: { crdtState: buf, crdtStateSize: buf.length,
        ...(changed ? { markdown, searchText: analysis!.searchText, outgoingLinks, markdownIndexedAt: new Date(), updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)) } : {}),
      },
      $inc: { updateCount: 1, ...(changed ? { revision: 1 } : {}) },
    })
    return
  }
  console.log(`[persistence] saveImmediate: ${docName} (${buf.length} bytes)`)


  await db.collection<DocumentDoc>('documents').updateOne(
    { docId: docName },
    {
      $set: { crdtState: buf, crdtStateSize: buf.length, updatedAt: new Date() },
      $inc: { updateCount: 1 },
      $setOnInsert: {
        title: 'Untitled Document',
        ownerUserId: null,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  )
}
