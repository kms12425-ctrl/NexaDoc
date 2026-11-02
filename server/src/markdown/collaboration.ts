import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import type { RawData, WebSocket } from 'ws'
import { resolveAccess, markdownCollabEnabled } from '../rbac'
import { mongoPersistence, setMarkdownWriter } from '../persistence'
import { getDB } from '../db'
import type { DocumentDoc, UserDoc } from '../types'
import { ObjectId } from 'mongodb'
import { MAX_MARKDOWN_BYTES } from './metadata'

interface Client { userId: string; canEdit: boolean; ids: Set<number>; user: { id: string; name: string; color: string }; expiresAt?: number }
interface Room {
  id: string; doc: Y.Doc; awareness: awarenessProtocol.Awareness; clients: Map<WebSocket, Client>
  queue: Promise<void>; timer?: NodeJS.Timeout; idle?: NodeJS.Timeout; check: NodeJS.Timeout; closed: boolean; epoch: number
}
const deleteSignature = (doc: Y.Doc) => JSON.stringify([...Y.decodeUpdate(Y.encodeStateAsUpdate(doc)).ds.clients].sort(([a], [b]) => a - b).map(([id, ranges]) => [id, ranges.map((range) => [range.clock, range.len])]))
const rooms = new Map<string, Promise<Room>>()
const send = (ws: WebSocket, bytes: Uint8Array) => { if (ws.readyState === ws.OPEN) ws.send(bytes) }
const broadcast = (room: Room, bytes: Uint8Array) => { for (const ws of room.clients.keys()) send(ws, bytes) }
const enqueue = (room: Room, work: () => Promise<void>) => {
  const operation = room.queue.then(work)
  room.queue = operation.catch((error) => {
    console.error('[markdown-collab]', error)
    for (const ws of room.clients.keys()) ws.close(1011, 'Unable to persist document; reconnect to retry')
  })
  return room.queue
}
async function saveAndAck(room: Room) {
  await mongoPersistence.writeState(room.id, room.doc)
  const doc = await getDB().collection<DocumentDoc>('documents').findOne({ docId: room.id, deletedAt: null })
  if (!doc || (doc.markdownEpoch ?? 0) !== room.epoch) { disconnectMarkdown(room.id); return }
  const message = encoding.createEncoder()
  encoding.writeVarUint(message, 4)
  encoding.writeVarString(message, JSON.stringify({ revision: doc.revision ?? 0, vector: Array.from(Y.encodeStateVector(room.doc)), deletes: deleteSignature(room.doc) }))
  broadcast(room, encoding.toUint8Array(message))
}
function schedule(room: Room) {
  clearTimeout(room.timer)
  room.timer = setTimeout(() => { void enqueue(room, () => saveAndAck(room)) }, 250)
}
async function getRoom(id: string): Promise<Room> {
  let pending = rooms.get(id)
  if (!pending) {
    pending = (async () => {
      const doc = new Y.Doc()
      await mongoPersistence.bindState(id, doc)
      const metadata = await getDB().collection<DocumentDoc>('documents').findOne({ docId: id })
      const awareness = new awarenessProtocol.Awareness(doc)
      awareness.setLocalState(null)
      const room: Room = { id, doc, awareness, clients: new Map(), queue: Promise.resolve(), closed: false, epoch: metadata?.markdownEpoch ?? 0, check: setInterval(() => {
        void enqueue(room, async () => {
          for (const [ws, client] of room.clients) {
            const access = await resolveAccess(id, client.userId)
            if (!markdownCollabEnabled() || !access || access.abilities.canEdit !== client.canEdit || (client.expiresAt && Date.now() >= client.expiresAt)) ws.close(4003, 'Document access changed')
          }
        })
      }, 2000) }
      room.check.unref()
      doc.on('update', (update: Uint8Array) => {
        const message = encoding.createEncoder(); encoding.writeVarUint(message, 0); sync.writeUpdate(message, update)
        broadcast(room, encoding.toUint8Array(message)); schedule(room)
      })
      awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const message = encoding.createEncoder(); encoding.writeVarUint(message, 1)
        encoding.writeVarUint8Array(message, awarenessProtocol.encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed]))
        broadcast(room, encoding.toUint8Array(message))
      })
      return room
    })()
    rooms.set(id, pending)
    pending.catch(() => { if (rooms.get(id) === pending) rooms.delete(id) })
  }
  const room = await pending
  if (room.closed) return getRoom(id)
  return room
}

/** Incoming messages are serialized with fresh RBAC checks, including sync step2. */
export async function connectMarkdown(ws: WebSocket, id: string, userId: string, expiresAt?: number, epoch?: string | null) {
  const waiting: RawData[] = []
  let room: Room | undefined
  let client: Client | undefined
  const receive = (raw: RawData) => {
    if (!room || !client) { if (waiting.length < 30) waiting.push(raw); else ws.close(1009); return }
    const currentRoom = room; const currentClient = client
    void enqueue(currentRoom, async () => {
      if (ws.readyState !== ws.OPEN) return
      const access = await resolveAccess(id, userId)
      if (!markdownCollabEnabled() || !access || access.abilities.canEdit !== currentClient.canEdit || (expiresAt && Date.now() >= expiresAt)) { ws.close(4003, 'Document access changed'); return }
      const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(Buffer.isBuffer(raw) ? raw : Buffer.concat(raw))
      const decoder = decoding.createDecoder(bytes)
      if (ws.readyState !== ws.OPEN) return
      const type = decoding.readVarUint(decoder)
      if (type === 0) {
        const kind = decoding.readVarUint(decoder)
        if (kind === 0) {
          const reply = encoding.createEncoder(); encoding.writeVarUint(reply, 0)
          sync.readSyncStep1(decoder, reply, currentRoom.doc)
          send(ws, encoding.toUint8Array(reply)); schedule(currentRoom)
        } else if (kind === 1 || kind === 2) {
          if (!access.abilities.canEdit) return
          const update = decoding.readVarUint8Array(decoder)
          // Validate before mutating the authoritative room or broadcasting it.
          const candidate = new Y.Doc()
          try {
            Y.applyUpdate(candidate, Y.encodeStateAsUpdate(currentRoom.doc)); Y.applyUpdate(candidate, update)
            if (Buffer.byteLength(candidate.getText('markdown').toString(), 'utf8') > MAX_MARKDOWN_BYTES) { ws.close(1009, 'Markdown content too large'); return }
          } finally { candidate.destroy() }
          setMarkdownWriter(currentRoom.doc, userId)
          Y.applyUpdate(currentRoom.doc, update, ws); schedule(currentRoom)
        }
      } else if (type === 1) {
        const state = decoding.createDecoder(decoding.readVarUint8Array(decoder))
        const count = decoding.readVarUint(state)
        if (count > 20) { ws.close(1009); return }
        const accepted: Array<{ id: number; clock: number; value: unknown }> = []
        for (let i = 0; i < count; i++) {
          const clientId = decoding.readVarUint(state); const clock = decoding.readVarUint(state)
          const value = JSON.parse(decoding.readVarString(state))
          // y-websocket relays awareness received from other peers too. Ignore
          // those echoes; this connection may only publish its own identities.
          if ([...currentRoom.clients.values()].some((other) => other !== currentClient && other.ids.has(clientId))) continue
          if (!currentClient.ids.has(clientId) && value?.user?.id !== userId) continue
          currentClient.ids.add(clientId)
          accepted.push({ id: clientId, clock, value: value === null ? null : { ...value, user: currentClient.user } })
        }
        if (currentClient.ids.size > 20) { ws.close(1009); return }
        const sanitized = encoding.createEncoder(); encoding.writeVarUint(sanitized, accepted.length)
        for (const item of accepted) {
          encoding.writeVarUint(sanitized, item.id); encoding.writeVarUint(sanitized, item.clock)
          encoding.writeVarString(sanitized, JSON.stringify(item.value))
        }
        awarenessProtocol.applyAwarenessUpdate(currentRoom.awareness, encoding.toUint8Array(sanitized), ws)
      } else if (type === 3) {
        const reply = encoding.createEncoder(); encoding.writeVarUint(reply, 1)
        encoding.writeVarUint8Array(reply, awarenessProtocol.encodeAwarenessUpdate(currentRoom.awareness, [...currentRoom.awareness.getStates().keys()]))
        send(ws, encoding.toUint8Array(reply))
      } else if (type === 4) await saveAndAck(currentRoom)
    })
  }
  ws.on('message', receive)
  ws.on('error', () => {})
  ws.on('close', (code, reason) => {
    if (!room || !client) return
    const currentRoom = room
    currentRoom.clients.delete(ws)
    awarenessProtocol.removeAwarenessStates(currentRoom.awareness, [...client.ids], ws)
    if (!currentRoom.clients.size) {
      clearTimeout(currentRoom.idle)
      currentRoom.idle = setTimeout(() => { void enqueue(currentRoom, async () => {
        if (currentRoom.clients.size) return
        await saveAndAck(currentRoom)
        if (currentRoom.clients.size) return
        currentRoom.closed = true; clearInterval(currentRoom.check); clearTimeout(currentRoom.timer)
        currentRoom.awareness.destroy(); currentRoom.doc.destroy(); rooms.delete(id)
      }) }, 500)
    }
  })
  try {
    room = await getRoom(id)
    if (ws.readyState !== ws.OPEN) return
    if (epoch !== undefined && epoch !== null && epoch !== String(room.epoch)) { ws.close(4009, 'Document version changed'); return }
    const access = await resolveAccess(id, userId)
    if (!access) { ws.close(4003); return }
    const user = await getDB().collection<UserDoc>('users').findOne({ _id: new ObjectId(userId) })
    client = { userId, canEdit: access.abilities.canEdit, ids: new Set(), user: { id: userId, name: user?.displayName || user?.username || 'User', color: user?.avatarColor || '#1a73e8' }, expiresAt }
    room.clients.set(ws, client)
    clearTimeout(room.idle)
    const first = encoding.createEncoder(); encoding.writeVarUint(first, 0); sync.writeSyncStep1(first, room.doc)
    send(ws, encoding.toUint8Array(first))
    const awareness = encoding.createEncoder(); encoding.writeVarUint(awareness, 1)
    encoding.writeVarUint8Array(awareness, awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...room.awareness.getStates().keys()]))
    send(ws, encoding.toUint8Array(awareness))
    waiting.splice(0).forEach(receive)
    schedule(room)
  } catch { ws.close(1011, 'Unable to load document') }
}

export function disconnectMarkdown(docId: string, userId?: string) {
  const pending = rooms.get(docId)
  if (pending) void pending.then((room) => {
    for (const [ws, client] of room.clients) if (!userId || client.userId === userId) ws.close(4003, 'Document access changed')
  })
}
export async function flushMarkdownRooms() {
  await Promise.all([...rooms.values()].map(async (pending) => {
    const room = await pending
    clearInterval(room.check); clearTimeout(room.timer); clearTimeout(room.idle)
    await room.queue; await saveAndAck(room)
    room.closed = true
    for (const ws of room.clients.keys()) ws.close(1001, 'Server restarting')
    room.awareness.destroy(); room.doc.destroy()
  }))
  rooms.clear()
}
