import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { documentsApi, getToken, type DocumentWithAbilities } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { createMarkdownTransport, MarkdownApiError } from '../../markdown/contentApi'
import { LocalMarkdownSession, type SessionSnapshot } from '../../markdown/session/LocalMarkdownSession'
import AppMenu from '../AppMenu'
import MarkdownSource from './MarkdownSource'
import MarkdownPreview from './MarkdownPreview'

const statusLabels = { idle: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', offline: 'Offline — changes kept in this browser', conflict: 'Conflict — saving paused' }

function ConflictDialog({ revision, busy, onClose, onResolve }: { revision: number; busy: boolean; onClose: () => void; onResolve: (mode: 'latest' | 'mine') => void }) {
  const modalRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Save conflict" onClick={() => { if (!busy) onClose() }} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); if (!busy) onClose() }
    if (event.key === 'Tab') {
      const controls = Array.from(modalRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const first = controls[0]; const last = controls[controls.length - 1]
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }}><div ref={modalRef} className="modal" onClick={(event) => event.stopPropagation()}>
    <h2 className="modal-title">This document changed in another window</h2>
    <p className="modal-subtitle">Load the latest version, or save your current source against revision {revision}. Saving stays paused until you choose.</p>
    <div className="modal-actions"><button type="button" className="modal-cancel" disabled={busy} onClick={() => onResolve('latest')}>Load latest</button><button type="button" className="modal-create" disabled={busy} onClick={() => onResolve('mine')}>Keep mine and overwrite</button></div>
    <button type="button" className="modal-cancel" disabled={busy} onClick={onClose}>Review my source</button>
  </div></div>
}

function EditorSession({ session, readOnly }: { session: LocalMarkdownSession; readOnly: boolean }) {
  const [markdown, setMarkdown] = useState(session.getMarkdown())
  const [state, setState] = useState<SessionSnapshot>(session.getSnapshot())
  const [targets, setTargets] = useState<ReadonlyMap<string, string | null>>(new Map())
  const [resolving, setResolving] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  useEffect(() => { if (state.conflict) setConflictOpen(true) }, [state.conflict])
  useEffect(() => {
    const unsubscribe = session.subscribe(setMarkdown)
    const unsubscribeStatus = session.subscribeStatus(() => setState(session.getSnapshot()))
    return () => { unsubscribe(); unsubscribeStatus() }
  }, [session])
  useEffect(() => {
    let active = true
    documentsApi.list('markdown').then((documents) => {
      if (!active) return
      const map = new Map<string, string | null>()
      for (const doc of documents) {
        if (doc.editorType !== 'markdown' || doc.shared) continue
        map.set(doc.name, map.has(doc.name) ? null : doc.id)
      }
      setTargets(map)
    }).catch(() => { /* Unknown titles still link to the home title filter. */ })
    return () => { active = false }
  }, [])

  const resolve = async (mode: 'latest' | 'mine') => {
    if (resolving) return
    setResolving(true)
    try { if (mode === 'latest') await session.loadLatest(); else await session.overwriteConflict() }
    finally { setResolving(false) }
  }

  return <>
    <div className="markdown-save-bar">
      <span role="status" aria-live="polite">{readOnly ? 'Read only' : statusLabels[state.status]}</span>
      <span className="markdown-revision">Revision {state.revision}</span>
      {!readOnly && <button type="button" className="modal-cancel" disabled={!state.dirty || state.status === 'saving' || !!state.recovery || !!state.conflict} onClick={() => { void session.saveNow() }}>Save now</button>}
    </div>
    {state.error && <p className="docs-error-banner" role="alert">{state.error} Your unsaved changes are still in the editor.</p>}
    {state.draftWarning && <p className="docs-info-banner" role="alert">{state.draftWarning}</p>}
    {state.recovery && <section className="markdown-recovery" aria-label="Unsaved draft">
      <h2>Unsaved draft found</h2><p>A local draft is available. Recover it to review your changes, or keep the server version.</p>
      <div><button type="button" className="modal-create" onClick={() => session.recoverDraft()}>Recover draft</button><button type="button" className="modal-cancel" onClick={() => session.discardDraft()}>Use server version</button></div>
    </section>}
    {state.conflict && <section className="markdown-conflict" aria-label="Save conflict">
      <h2>Saving is paused</h2><p>Your source and the server version have changed independently.</p>
      <div><button type="button" className="modal-cancel" onClick={() => setConflictOpen(true)}>Resolve conflict</button></div>
    </section>}
    {state.conflict && conflictOpen && <ConflictDialog revision={state.conflict.revision} busy={resolving} onClose={() => setConflictOpen(false)} onResolve={(mode) => { void resolve(mode) }} />}
    <div className="markdown-editor-panes">
      <section className="markdown-source-pane" aria-label="Source pane"><h2>Source</h2><MarkdownSource session={session} readOnly={readOnly || !!state.recovery || resolving} /></section>
      <section className="markdown-preview-pane" aria-label="Preview pane"><h2>Preview</h2><MarkdownPreview markdown={markdown} targets={targets} /></section>
    </div>
  </>
}

export default function MarkdownEditor({ metadata }: { metadata: DocumentWithAbilities }) {
  const { user, logout } = useAuth()
  const [session, setSession] = useState<LocalMarkdownSession | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const readOnly = metadata.abilities.canEdit === false

  useEffect(() => {
    if (!user) return
    let active = true
    let current: LocalMarkdownSession | null = null
    const controller = new AbortController()
    const token = getToken()
    const transport = createMarkdownTransport(metadata.id, token)
    setSession(null)
    setError('')
    transport.load(controller.signal).then((initial) => {
      if (!active) return
      current = new LocalMarkdownSession({
        docId: metadata.id, userId: user.id, initial, transport, readOnly,
        isAuthorized: () => getToken() === token && !!token,
        onUnauthorized: logout,
      })
      setSession(current)
    }).catch((reason: unknown) => {
      if (!active) return
      if (reason instanceof MarkdownApiError && reason.status === 401) logout()
      setError(reason instanceof Error ? reason.message : 'Unable to load Markdown.')
    })
    return () => { active = false; controller.abort(); current?.destroy() }
  }, [metadata.id, user?.id, attempt, readOnly, logout])

  return <div className="docs-shell markdown-workspace markdown-editor-shell">
    <header className="topbar"><div className="topbar-left">
      <AppMenu current="markdown-editor" />
      <Link className="back-btn" to="/markdown" aria-label="Back to Markdown documents">←</Link>
      <h1 className="markdown-editor-title">{metadata.name}</h1>
    </div></header>
    <main className="markdown-editor-main">
      {session ? <EditorSession key={metadata.id} session={session} readOnly={readOnly} />
        : error ? <section className="route-status"><h2>Unable to load Markdown</h2><p role="alert">{error}</p><button type="button" className="new-doc-btn" onClick={() => setAttempt((value) => value + 1)}>Try again</button></section>
          : <p className="route-status" role="status">Loading Markdown…</p>}
    </main>
  </div>
}
