import type { MarkdownDocumentPayload, MarkdownSaveStatus } from '../../types'
import { MarkdownApiError, MarkdownConflictError, type MarkdownContentTransport } from '../contentApi'
import type { MarkdownSession } from './MarkdownSession'

export interface MarkdownDraft { markdown: string; revision: number; savedAt: number }
export interface SessionSnapshot {
  status: MarkdownSaveStatus
  revision: number
  dirty: boolean
  error: string
  draftWarning: string
  recovery: MarkdownDraft | null
  conflict: MarkdownDocumentPayload | null
}

interface Options {
  docId: string
  userId: string
  initial: MarkdownDocumentPayload
  transport: MarkdownContentTransport
  readOnly?: boolean
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  isAuthorized?: () => boolean
  onUnauthorized?: () => void
}

/** Serialized REST writes; a successful old write never clears a newer local draft. */
export class LocalMarkdownSession implements MarkdownSession {
  readonly draftKey: string
  private markdown: string
  private server: MarkdownDocumentPayload
  private state: SessionSnapshot
  private storage: Options['storage'] | null = null
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private draftTimer: ReturnType<typeof setTimeout> | undefined
  private inFlight: Promise<void> | null = null
  private destroyed = false
  private composing = false
  private blocked = false
  private listeners = new Set<(markdown: string) => void>()
  private statusListeners = new Set<(status: MarkdownSaveStatus) => void>()
  private onVisibility = () => {
    if (document.visibilityState === 'hidden') { this.persistDraft(); void this.saveNow() }
  }
  private onLeave = () => this.flushOnLeave()
  private onOnline = () => { if (this.state.status === 'offline') void this.saveNow() }

  constructor(private options: Options) {
    this.markdown = options.initial.markdown
    this.server = options.initial
    this.draftKey = `md_draft:${encodeURIComponent(options.userId)}:${encodeURIComponent(options.docId)}`
    this.state = { status: 'saved', revision: options.initial.revision, dirty: false, error: '', draftWarning: '', recovery: null, conflict: null }
    try { this.storage = options.storage ?? window.localStorage } catch { this.storageWarning() }
    if (!options.readOnly) this.readDraft()
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', this.onLeave)
    window.addEventListener('beforeunload', this.onLeave)
    window.addEventListener('online', this.onOnline)
  }

  getMarkdown() { return this.markdown }
  getSnapshot(): SessionSnapshot { return { ...this.state } }
  subscribe(fn: (markdown: string) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  subscribeStatus(fn: (status: MarkdownSaveStatus) => void) { this.statusListeners.add(fn); return () => { this.statusListeners.delete(fn) } }

  private emit(markdownChanged = false) {
    if (this.destroyed) return
    if (markdownChanged) this.listeners.forEach((fn) => fn(this.markdown))
    this.statusListeners.forEach((fn) => fn(this.state.status))
  }

  private storageWarning() { this.state.draftWarning = 'Local draft storage is unavailable. Keep this page open until the document is saved.' }
  private readDraft() {
    try {
      const raw = this.storage?.getItem(this.draftKey)
      if (!raw) return
      const draft: MarkdownDraft = JSON.parse(raw)
      if (typeof draft.markdown !== 'string' || !Number.isSafeInteger(draft.revision) || draft.revision < 0 || !Number.isFinite(draft.savedAt)) return
      if (draft.markdown === this.markdown) this.removeDraft(draft.markdown)
      // Offer older/conflicted drafts too: clocks and interrupted responses must not destroy work.
      else this.state.recovery = draft
    } catch { this.storageWarning() }
  }

  private persistDraft() {
    clearTimeout(this.draftTimer)
    this.draftTimer = undefined
    if (this.options.readOnly || !this.state.dirty) return
    try {
      this.storage?.setItem(this.draftKey, JSON.stringify({ markdown: this.markdown, revision: this.state.revision, savedAt: Date.now() }))
    } catch { this.storageWarning() }
  }

  private removeDraft(expected: string) {
    try {
      const raw = this.storage?.getItem(this.draftKey)
      if (raw && JSON.parse(raw).markdown === expected) this.storage?.removeItem(this.draftKey)
    } catch { this.storageWarning() }
  }

  private canSave() {
    return !this.options.readOnly && !this.composing && !this.blocked && !this.state.conflict && !this.state.recovery && (this.options.isAuthorized?.() ?? true)
  }

  private schedule() {
    clearTimeout(this.saveTimer)
    if (!this.destroyed && this.canSave() && this.state.dirty) this.saveTimer = setTimeout(() => { void this.saveNow() }, 800)
  }

  update(markdown: string) {
    if (this.destroyed || this.options.readOnly || markdown === this.markdown || this.state.recovery) return
    this.markdown = markdown
    this.state.dirty = markdown !== this.server.markdown || !!this.inFlight
    this.state.error = this.blocked ? this.state.error : ''
    this.state.status = this.state.conflict ? 'conflict' : this.inFlight ? 'saving' : this.state.dirty ? 'idle' : 'saved'
    if (!this.draftTimer) this.draftTimer = setTimeout(() => { this.persistDraft(); this.emit() }, 300)
    this.schedule()
    this.emit(true)
  }

  setComposing(value: boolean) {
    this.composing = value
    if (value) clearTimeout(this.saveTimer)
    else this.schedule()
  }

  recoverDraft() {
    const draft = this.state.recovery
    if (!draft || this.options.readOnly) return
    this.state.recovery = null
    this.markdown = draft.markdown
    this.state.dirty = true
    if (draft.revision !== this.server.revision) {
      this.state.conflict = this.server
      this.state.status = 'conflict'
    } else this.state.status = 'idle'
    this.persistDraft()
    this.schedule()
    this.emit(true)
  }

  discardDraft() {
    if (this.state.recovery) this.removeDraft(this.state.recovery.markdown)
    this.state.recovery = null
    this.emit()
  }

  async loadLatest() {
    if (!this.state.conflict) return
    try {
      const latest = await this.options.transport.load()
      const previous = this.markdown
      this.server = latest
      this.markdown = latest.markdown
      this.state = { ...this.state, status: 'saved', revision: latest.revision, dirty: false, error: '', conflict: null }
      this.removeDraft(previous)
      this.emit(true)
    } catch (error) { this.failed(error); this.emit() }
  }

  async overwriteConflict() {
    if (!this.state.conflict || this.options.readOnly) return
    this.state.revision = this.state.conflict.revision
    this.state.conflict = null
    this.state.error = ''
    this.state.dirty = true
    this.state.status = 'idle'
    await this.saveNow()
  }

  private failed(error: unknown) {
    if (error instanceof MarkdownConflictError) {
      this.state.conflict = error.current
      this.state.status = 'conflict'
      this.state.error = ''
    } else {
      this.state.error = error instanceof Error ? error.message : 'Unable to save changes.'
      this.state.status = error instanceof MarkdownApiError ? 'idle' : 'offline'
      if (error instanceof MarkdownApiError && [401, 403, 404].includes(error.status)) this.blocked = true
      if (error instanceof MarkdownApiError && error.status === 401) this.options.onUnauthorized?.()
    }
    this.persistDraft()
  }

  saveNow(keepalive = false): Promise<void> {
    clearTimeout(this.saveTimer)
    if (this.inFlight) return this.inFlight
    if (!this.canSave() || !this.state.dirty) return Promise.resolve()
    this.inFlight = this.flush(keepalive).finally(() => { this.inFlight = null })
    return this.inFlight
  }

  private async flush(keepalive: boolean) {
    while (this.canSave() && this.state.dirty) {
      const sent = this.markdown
      if (this.destroyed && !this.keepaliveFits(sent)) break
      this.state.status = 'saving'
      this.state.error = ''
      this.emit()
      try {
        const result = await this.options.transport.save(sent, this.state.revision, keepalive)
        this.server = { markdown: sent, ...result }
        this.state.revision = result.revision
        this.state.dirty = this.markdown !== sent
        if (this.state.dirty) this.persistDraft()
        else {
          clearTimeout(this.draftTimer)
          this.draftTimer = undefined
          this.removeDraft(sent)
        }
        this.state.status = this.state.dirty ? 'idle' : 'saved'
        this.emit()
      } catch (error) { this.failed(error); this.emit(); break }
    }
  }

  private flushOnLeave() {
    this.persistDraft()
    if (this.keepaliveFits(this.markdown) && !this.composing) void this.saveNow(true)
  }

  private keepaliveFits(markdown: string) {
    return new TextEncoder().encode(JSON.stringify({ markdown, baseRevision: this.state.revision })).byteLength < 60_000
  }

  destroy() {
    if (this.destroyed) return
    this.flushOnLeave()
    this.destroyed = true
    clearTimeout(this.saveTimer)
    clearTimeout(this.draftTimer)
    this.listeners.clear()
    this.statusListeners.clear()
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pagehide', this.onLeave)
    window.removeEventListener('beforeunload', this.onLeave)
    window.removeEventListener('online', this.onOnline)
  }
}
