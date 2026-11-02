import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { getToken, getYjsWsUrl } from '../../services/api'
import type { MarkdownSession } from './MarkdownSession'
import type { SessionSnapshot } from './LocalMarkdownSession'
import type { MarkdownDocumentPayload, MarkdownSaveStatus, User } from '../../types'

interface Options {
  docId: string; user: User; initial: MarkdownDocumentPayload; readOnly: boolean
  onAccessChanged: () => void
  signal?: AbortSignal
}
export class CollabMarkdownSession implements MarkdownSession {
  readonly doc = new Y.Doc()
  readonly text: Y.Text
  readonly provider: WebsocketProvider
  readonly undoManager: Y.UndoManager
  private cache?: IndexeddbPersistence
  private destroyed = false
  private recoveryKey: string
  private epoch: number
  private state: SessionSnapshot
  private listeners = new Set<(markdown: string) => void>()
  private statuses = new Set<(status: MarkdownSaveStatus) => void>()
  private acknowledged = new Map<number, number>()
  private acknowledgedDeletes = ''
  private deleteSignature() { return JSON.stringify([...Y.decodeUpdate(Y.encodeStateAsUpdate(this.doc)).ds.clients].sort(([a], [b]) => a - b).map(([id, ranges]) => [id, ranges.map((range) => [range.clock, range.len])])) }
  private onOnline = () => { if (!this.destroyed) this.provider.connect() }
  private onOffline = () => { this.provider.disconnect(); this.connection('disconnected') }

  static async create(options: Options) {
    const session = new CollabMarkdownSession(options)
    if (session.cache) {
      let timeout: ReturnType<typeof setTimeout> | undefined
      try { await Promise.race([session.cache.whenSynced, new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('Offline storage unavailable')), 3000) })]) }
      catch { session.state.draftWarning = 'Offline storage is unavailable. Keep this page open until saved.' }
      finally { clearTimeout(timeout) }
    }
    if (options.signal?.aborted) { session.destroy(); throw new DOMException('Aborted', 'AbortError') }
    session.provider.connect()
    return session
  }
  private constructor(private options: Options) {
    const { initial, docId, user, readOnly } = options
    this.epoch = initial.collaborationEpoch ?? 0
    this.recoveryKey = `markdown_offline:${user.id}:${docId}`
    if (!initial.crdtState) throw new Error('Collaboration state is unavailable; reload the document.')
    Y.applyUpdate(this.doc, Uint8Array.from(atob(initial.crdtState), (item) => item.charCodeAt(0)))
    this.acknowledged = Y.decodeStateVector(Y.encodeStateVector(this.doc))
    this.acknowledgedDeletes = this.deleteSignature()
    this.text = this.doc.getText('markdown')
    this.undoManager = new Y.UndoManager(this.text, { trackedOrigins: new Set([this]) })
    this.state = { status: 'saved', connection: 'connecting', peers: [], revision: initial.revision, dirty: false, error: '', draftWarning: '', recovery: null, conflict: null }
    if (!readOnly) {
      try {
        const draft = JSON.parse(localStorage.getItem(this.recoveryKey) ?? 'null')
        if (draft && draft.epoch !== this.epoch && typeof draft.markdown === 'string') this.state.previousDraft = draft.markdown
      } catch { this.state.draftWarning = 'Offline recovery storage is unavailable.' }
    }
    // User + document + epoch isolates accounts and invalidates rollback-era caches.
    // Reader sessions never load an editor's cached updates.
    if (!readOnly && typeof indexedDB !== 'undefined') {
      try { this.cache = new IndexeddbPersistence(`markdown:${user.id}:${docId}:${initial.collaborationEpoch ?? 0}`, this.doc) }
      catch { this.state.draftWarning = 'Offline storage is unavailable. Keep this page open until saved.' }
    }
    this.provider = new WebsocketProvider(getYjsWsUrl(), docId, this.doc, {
      connect: false, disableBc: true, maxBackoffTime: 3000,
      params: { token: getToken() ?? '', epoch: String(initial.collaborationEpoch ?? 0) },
    })
    this.provider.messageHandlers[4] = (_encoder, decoder) => {
      const ack = JSON.parse(decoding.readVarString(decoder)) as { revision: number; vector: number[]; deletes: string }
      this.acknowledged = Y.decodeStateVector(new Uint8Array(ack.vector))
      this.acknowledgedDeletes = ack.deletes
      this.state.revision = ack.revision
      this.refreshStatus()
    }
    this.provider.on('status', ({ status }) => this.connection(status === 'connecting' ? 'connecting' : status === 'connected' ? 'connected' : 'disconnected'))
    this.provider.on('connection-close', (event) => {
      if (this.destroyed) return
      if (event && [4003, 4009].includes(event.code)) {
        this.provider.disconnect(); options.onAccessChanged()
      }
    })
    this.provider.awareness.setLocalStateField('user', { id: user.id, name: user.displayName || user.username, color: user.avatarColor })
    this.provider.awareness.on('change', () => {
      const peers = new Map<string, { id: string; name: string; color: string }>()
      for (const value of this.provider.awareness.getStates().values()) {
        const person = value.user
        if (person && person.id !== user.id) peers.set(person.id, person)
      }
      this.state.peers = [...peers.values()]; this.emit()
    })
    this.doc.on('update', () => {
      this.refreshStatus()
      for (const listener of this.listeners) listener(this.getMarkdown())
    })
    window.addEventListener('online', this.onOnline)
    window.addEventListener('offline', this.onOffline)
  }
  private connection(connection: NonNullable<SessionSnapshot['connection']>) {
    this.state.connection = connection; this.refreshStatus()
  }
  private refreshStatus() {
    if (this.destroyed) return
    const local = Y.decodeStateVector(Y.encodeStateVector(this.doc))
    this.state.dirty = !this.options.readOnly && (this.deleteSignature() !== this.acknowledgedDeletes || [...local].some(([id, clock]) => (this.acknowledged.get(id) ?? 0) < clock))
    this.state.status = this.state.connection !== 'connected' ? 'offline' : this.state.dirty ? 'saving' : 'saved'
    if (!this.options.readOnly) {
      try {
        const previous = JSON.parse(localStorage.getItem(this.recoveryKey) ?? 'null')
        if (this.state.dirty && (!previous || previous.epoch === this.epoch)) localStorage.setItem(this.recoveryKey, JSON.stringify({ epoch: this.epoch, markdown: this.getMarkdown() }))
        else if (!this.state.dirty && previous?.epoch === this.epoch) localStorage.removeItem(this.recoveryKey)
      } catch { this.state.draftWarning = 'Offline recovery storage is unavailable. Keep this page open until saved.' }
    }
    this.emit()
  }
  discardPreviousDraft() {
    try { localStorage.removeItem(this.recoveryKey) } catch {}
    this.state.previousDraft = undefined; this.emit()
  }
  private emit() { if (!this.destroyed) for (const listener of this.statuses) listener(this.state.status) }
  getMarkdown() { return this.text.toString() }
  getSnapshot(): SessionSnapshot { return { ...this.state } }
  subscribe(listener: (markdown: string) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  subscribeStatus(listener: (status: MarkdownSaveStatus) => void) { this.statuses.add(listener); return () => { this.statuses.delete(listener) } }
  update(markdown: string) {
    if (this.destroyed || this.options.readOnly) return
    const previous = this.getMarkdown()
    let from = 0; while (from < previous.length && from < markdown.length && previous[from] === markdown[from]) from++
    let end = previous.length; let nextEnd = markdown.length
    while (end > from && nextEnd > from && previous[end - 1] === markdown[nextEnd - 1]) { end--; nextEnd-- }
    this.doc.transact(() => { this.text.delete(from, end - from); this.text.insert(from, markdown.slice(from, nextEnd)) }, this)
  }
  async saveNow() {
    if (this.provider.ws?.readyState !== WebSocket.OPEN) return
    const request = encoding.createEncoder(); encoding.writeVarUint(request, 4)
    this.provider.ws.send(encoding.toUint8Array(request))
  }
  setComposing(_value: boolean) { /* CodeMirror/yCollab own the IME transaction. */ }
  async loadLatest() { /* CRDT merges updates without revision conflicts. */ }
  async overwriteConflict() {}
  recoverDraft() {}
  discardDraft() {}
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    window.removeEventListener('online', this.onOnline); window.removeEventListener('offline', this.onOffline)
    this.provider.destroy(); this.undoManager.destroy()
    if (this.cache) void this.cache.destroy().catch(() => {})
    this.doc.destroy(); this.listeners.clear(); this.statuses.clear()
  }
}
