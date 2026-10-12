import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { toBuffer, mongoPersistence } from './persistence'
import { getDB } from './db'
import type { DocumentDoc } from './types'

// ── toBuffer: 纯函数测试 ───────────────────────────────────────
describe('toBuffer', () => {
  it('returns empty buffer for null', () => {
    expect(toBuffer(null)).toEqual(Buffer.alloc(0))
  })

  it('returns empty buffer for undefined', () => {
    expect(toBuffer(undefined)).toEqual(Buffer.alloc(0))
  })

  it('returns empty buffer for empty string', () => {
    expect(toBuffer('')).toEqual(Buffer.alloc(0))
  })

  it('returns a Buffer copy for Buffer input', () => {
    const buf = Buffer.from([1, 2, 3])
    const result = toBuffer(buf)
    expect(result).toEqual(buf)
  })

  it('handles BSON Binary with Uint8Array buffer', () => {
    const fakeBinary = { buffer: new Uint8Array([1, 2, 3]) }
    const result = toBuffer(fakeBinary)
    expect(result).toEqual(Buffer.from([1, 2, 3]))
  })

  it('handles BSON Binary with ArrayBuffer buffer', () => {
    const fakeBinary = { buffer: new ArrayBuffer(4) }
    const result = toBuffer(fakeBinary)
    expect(result.length).toBe(4)
  })

  it('returns empty buffer for unknown type', () => {
    expect(toBuffer(42)).toEqual(Buffer.alloc(0))
  })
})

// ── mongoPersistence.bindState ─────────────────────────────────
describe('mongoPersistence.bindState', () => {
  it('creates new document record if not exists', async () => {
    const docName = `bind-new-${Date.now()}`
    const ydoc = new Y.Doc()

    await mongoPersistence.bindState(docName, ydoc)

    const db = getDB()
    const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: docName })
    expect(doc).not.toBeNull()
    expect(doc!.title).toBe('Untitled Document')
    expect(doc!.crdtStateSize).toBe(0)

    ydoc.destroy()
  })

  it('loads existing CRDT state into ydoc', async () => {
    const docName = `bind-existing-${Date.now()}`
    const db = getDB()

    // 先创建一个有内容的 Yjs doc 并编码
    const sourceDoc = new Y.Doc()
    sourceDoc.getText('content').insert(0, 'hello')
    const state = Buffer.from(Y.encodeStateAsUpdate(sourceDoc))

    // 插入 DB 记录
    await db.collection<DocumentDoc>('documents').insertOne({
      docId: docName,
      title: 'Pre-existing',
      ownerUserId: null,
      crdtState: state,
      crdtStateSize: state.length,
      updateCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // bindState 应恢复内容
    const ydoc = new Y.Doc()
    await mongoPersistence.bindState(docName, ydoc)

    const restored = ydoc.getText('content').toString()
    expect(restored).toBe('hello')

    sourceDoc.destroy()
    ydoc.destroy()
  })

  it('does not create new record if exists but crdtState is empty', async () => {
    const docName = `bind-empty-state-${Date.now()}`
    const db = getDB()

    await db.collection<DocumentDoc>('documents').insertOne({
      docId: docName,
      title: 'Empty State Doc',
      ownerUserId: null,
      crdtState: Buffer.alloc(0),
      crdtStateSize: 0,
      updateCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const ydoc = new Y.Doc()
    await mongoPersistence.bindState(docName, ydoc)

    // 不应新增额外记录
    const count = await db.collection<DocumentDoc>('documents').countDocuments({ docId: docName })
    expect(count).toBe(1)

    ydoc.destroy()
  })
})

// ── mongoPersistence.writeState ────────────────────────────────
describe('mongoPersistence.writeState', () => {
  it('persists ydoc state to MongoDB', async () => {
    const docName = `write-${Date.now()}`
    const ydoc = new Y.Doc()
    ydoc.getText('content').insert(0, 'write-test')

    await mongoPersistence.writeState(docName, ydoc)

    const db = getDB()
    const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: docName })
    expect(doc).not.toBeNull()
    expect(doc!.crdtStateSize).toBeGreaterThan(0)
    expect(doc!.updateCount).toBeGreaterThanOrEqual(1)

    ydoc.destroy()
  })

  it('clears pending debounce timer and writes immediately', async () => {
    const docName = `write-timer-${Date.now()}`
    const db = getDB()

    // 先 bindState 建立 timer 机制
    const ydoc = new Y.Doc()
    await mongoPersistence.bindState(docName, ydoc)

    // 触发更新（会 scheduleSave, debounce 1s）
    ydoc.getText('content').insert(0, 'timer-test')

    // 立即 writeState，应清除 timer 并写入
    await mongoPersistence.writeState(docName, ydoc)

    const doc = await db.collection<DocumentDoc>('documents').findOne({ docId: docName })
    expect(doc).not.toBeNull()
    expect(doc!.crdtStateSize).toBeGreaterThan(0)

    ydoc.destroy()
  })
})
