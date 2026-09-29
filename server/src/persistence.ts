import * as Y from 'yjs'
import { getDB } from './db'
import type { DocumentDoc } from './types'

const DEBOUNCE_MS = 1000
const timers = new Map<string, NodeJS.Timeout>()

/**
 * Yjs 持久化层——处理文档加载与变更持久化。
 *
 * y-websocket v2 通过 setPersistence() 全局注册 persistence 对象，
 * 在 getYDoc() 创建新文档时自动调用 bindState，
 * 在 closeConn()（所有连接断开）时自动调用 writeState。
 *
 * bindState/writeState 的第二个参数是 WSSharedDoc（继承自 Y.Doc）。
 */
export const mongoPersistence = {
  async bindState(docName: string, ydoc: Y.Doc): Promise<void> {
    console.log(`[persistence] bindState: ${docName}`)
    try {
      const db = getDB()
      const existing = await db.collection<DocumentDoc>('documents').findOne({ docId: docName })

      if (existing?.crdtState && existing.crdtState.length > 0) {
        // 从 MongoDB 恢复 CRDT 状态到内存
        Y.applyUpdate(ydoc, new Uint8Array(existing.crdtState.buffer))
        console.log(`[persistence] Restored state for ${docName} (${existing.crdtState.length} bytes)`)
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
      ydoc.on('update', () => {
        scheduleSave(docName, ydoc)
      })
    } catch (err) {
      console.error(`[persistence] bindState ERROR for ${docName}:`, err)
      throw err
    }
  },

  async writeState(docName: string, ydoc: Y.Doc): Promise<void> {
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

function scheduleSave(docName: string, ydoc: Y.Doc): void {
  const existing = timers.get(docName)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    saveImmediate(docName, ydoc)
    timers.delete(docName)
  }, DEBOUNCE_MS)
  timers.set(docName, timer)
}

async function saveImmediate(docName: string, ydoc: Y.Doc): Promise<void> {
  const db = getDB()
  const state = Y.encodeStateAsUpdate(ydoc)
  const buf = Buffer.from(state)

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
