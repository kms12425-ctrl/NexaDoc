import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { documentsApi, getToken, type DocumentWithAbilities } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { createMarkdownTransport, MarkdownApiError } from '../../markdown/contentApi'
import { CollabMarkdownSession } from '../../markdown/session/CollabMarkdownSession'
import { useMarkdownNotifications } from '../../markdown/useMarkdownNotifications'
import { LocalMarkdownSession, type SessionSnapshot } from '../../markdown/session/LocalMarkdownSession'
import AppMenu from '../AppMenu'
import MarkdownSource from './MarkdownSource'
import MarkdownPreview from './MarkdownPreview'
import MarkdownToolbar from './MarkdownToolbar'
import type { MarkdownSourceHandle } from './MarkdownSource'
import BacklinksPanel from './BacklinksPanel'
import { useNavigate } from 'react-router-dom'

const ShareModal = lazy(() => import('../ShareModal'))
const ExportMenu = lazy(() => import('./ExportMenu'))

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

function EditorSession({ session, readOnly, docId, initialTitle, initialTags }: { session: LocalMarkdownSession | CollabMarkdownSession; readOnly: boolean; docId: string; initialTitle: string; initialTags: string[] }) {
  const [markdown, setMarkdown] = useState(session.getMarkdown())
  const [state, setState] = useState<SessionSnapshot>(session.getSnapshot())
  const [titleTargets, setTitleTargets] = useState<ReadonlyMap<string, string | null>>(new Map())
  const [resolvedTargets, setResolvedTargets] = useState<ReadonlyMap<string, string | null>>(new Map())
  const [resolving, setResolving] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [layout, setLayout] = useState<'source' | 'split' | 'preview'>('split')
  const [title, setTitle] = useState(initialTitle)
  useEffect(() => setTitle(initialTitle), [initialTitle])
  const [tags, setTags] = useState(initialTags)
  useEffect(() => setTags(initialTags), [initialTags])
  const [tagText, setTagText] = useState('')
  const [metadataBusy, setMetadataBusy] = useState(false)
  const [metadataError, setMetadataError] = useState('')
  const metadataQueueRef = useRef<Promise<void>>(Promise.resolve())
  const metadataPendingRef = useRef(0)
  const sourceRef = useRef<MarkdownSourceHandle>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const syncingScrollRef = useRef(false)
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
        if (doc.editorType !== 'markdown') continue
        map.set(doc.name, map.has(doc.name) ? null : doc.id)
      }
      setTitleTargets(map)
    }).catch(() => { /* Unknown titles still link to the home title filter. */ })
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    documentsApi.getLinks(docId).then(({ outgoing }) => {
      if (!active) return
      setResolvedTargets(new Map(outgoing.map((link) => [link.title, link.targetDocId])))
    }).catch(() => { if (active) setResolvedTargets(new Map()) })
    return () => { active = false }
  }, [docId, state.revision])
  useEffect(() => {
    const source = sourceRef.current?.getScroller()
    if (!source) return
    const onScroll = () => syncScroll('source')
    source.addEventListener('scroll', onScroll)
    return () => source.removeEventListener('scroll', onScroll)
  })

  const resolve = async (mode: 'latest' | 'mine') => {
    if (resolving) return
    setResolving(true)
    try { if (mode === 'latest') await session.loadLatest(); else await session.overwriteConflict() }
    finally { setResolving(false) }
  }
  const saveMetadata = (changes: { title?: string; tags?: string[] }) => {
    if (readOnly) return
    metadataPendingRef.current += 1
    setMetadataBusy(true)
    // A title blur can overlap tag input. Serialize both instead of silently
    // dropping the later update while another metadata request is pending.
    const operation = metadataQueueRef.current.then(async () => {
      setMetadataError('')
      try { await documentsApi.updateMetadata(docId, changes) }
      catch (error) { setMetadataError(error instanceof Error ? error.message : 'Unable to save document details.') }
      finally {
        metadataPendingRef.current -= 1
        if (metadataPendingRef.current === 0) setMetadataBusy(false)
      }
    })
    metadataQueueRef.current = operation
    return operation
  }
  const addTag = () => {
    const value = tagText.trim().replace(/^#+/, '').replace(/\s+/g, ' ')
    if (!value || tags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase()) || tags.length >= 20) {
      setTagText('')
      return
    }
    const next = [...tags, value]; setTags(next); setTagText(''); void saveMetadata({ tags: next })
  }
  const syncScroll = (from: 'source' | 'preview') => {
    if (syncingScrollRef.current) return
    const source = sourceRef.current?.getScroller(); const preview = previewRef.current
    if (!source || !preview) return
    const left = from === 'source' ? source : preview; const right = from === 'source' ? preview : source
    const ratio = left.scrollTop / Math.max(1, left.scrollHeight - left.clientHeight)
    syncingScrollRef.current = true
    right.scrollTop = ratio * Math.max(0, right.scrollHeight - right.clientHeight)
    requestAnimationFrame(() => { syncingScrollRef.current = false })
  }
  const characters = [...markdown].length
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0
  const targets = new Map(titleTargets)
  for (const [title, targetId] of resolvedTargets) targets.set(title, targetId)

  return <>
    <div className="markdown-save-bar">
      <span role="status" aria-live="polite">{readOnly ? 'Read only' : state.connection && state.status === 'offline' ? 'Offline — changes kept in this browser' : statusLabels[state.status]}</span>
      <span className="markdown-revision">Revision {state.revision}</span>
      {state.connection && <span role="status" aria-label="Collaboration connection">{state.connection === 'connected' ? 'Connected' : state.connection === 'connecting' ? 'Reconnecting…' : 'Offline — reconnecting'}</span>}
      {state.peers && <span className="markdown-presence" aria-label="Online collaborators">{state.peers.length ? state.peers.map((peer) => <span key={peer.id} title={peer.name} style={{ color: peer.color }}>{peer.name}</span>) : 'Only you'}</span>}
      <Suspense fallback={<button type="button" className="export-menu-trigger" disabled>Export ▾</button>}>
        <ExportMenu title={title} getMarkdown={() => session.getMarkdown()} />
      </Suspense>
      {!readOnly && <button type="button" className="modal-cancel" disabled={!state.dirty || state.status === 'saving' || !!state.recovery || !!state.conflict} onClick={() => { void session.saveNow() }}>Save now</button>}
    </div>
    <div className="markdown-document-details">
      <label>Title <input value={title} disabled={readOnly || metadataBusy} onChange={(event) => setTitle(event.target.value)} onBlur={() => { if (title.trim() && title !== initialTitle) void saveMetadata({ title: title.trim() }) }} /></label>
      <div className="markdown-tags" aria-label="Tags">{tags.map((tag) => <span key={tag} className="markdown-tag">{tag}{!readOnly && <button type="button" aria-label={`Remove ${tag}`} onClick={() => { const next = tags.filter((value) => value !== tag); setTags(next); void saveMetadata({ tags: next }) }}>×</button>}</span>)}
        {!readOnly && <input aria-label="Add tag" value={tagText} placeholder="Add tag" onChange={(event) => setTagText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} onBlur={addTag} />}
      </div>
      {metadataError && <p role="alert" className="docs-error-banner">{metadataError}</p>}
    </div>
    <div className="markdown-layout-controls" role="group" aria-label="Editor layout">{(['source', 'split', 'preview'] as const).map((mode) => <button type="button" className={layout === mode ? 'active' : ''} aria-pressed={layout === mode} onClick={() => setLayout(mode)} key={mode}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
    <MarkdownToolbar disabled={readOnly || !!state.recovery || resolving} onInsert={(value) => sourceRef.current?.insert(value)} onWrap={(prefix, suffix) => sourceRef.current?.wrap(prefix, suffix)} />
    {state.error && <p className="docs-error-banner" role="alert">{state.error} Your unsaved changes are still in the editor.</p>}
    {state.draftWarning && <p className="docs-info-banner" role="alert">{state.draftWarning}</p>}
    {state.previousDraft !== undefined && session instanceof CollabMarkdownSession && <section className="markdown-recovery" aria-label="Previous offline draft">
      <h2>Previous offline draft preserved</h2><p>The document version changed while you were offline. Review your earlier draft before copying changes into the current version.</p>
      <button type="button" className="modal-create" onClick={() => {
        const url = URL.createObjectURL(new Blob([state.previousDraft!], { type: 'text/markdown;charset=utf-8' }))
        const link = document.createElement('a'); link.href = url; link.download = 'previous-offline-draft.md'; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }}>Download previous offline draft</button>
      <button type="button" className="modal-cancel" onClick={() => session.discardPreviousDraft()}>Discard previous offline draft</button>
    </section>}
    {state.recovery && <section className="markdown-recovery" aria-label="Unsaved draft">
      <h2>Unsaved draft found</h2><p>A local draft is available. Recover it to review your changes, or keep the server version.</p>
      <div><button type="button" className="modal-create" onClick={() => session.recoverDraft()}>Recover draft</button><button type="button" className="modal-cancel" onClick={() => session.discardDraft()}>Use server version</button></div>
    </section>}
    {state.conflict && <section className="markdown-conflict" aria-label="Save conflict">
      <h2>Saving is paused</h2><p>Your source and the server version have changed independently.</p>
      <div><button type="button" className="modal-cancel" onClick={() => setConflictOpen(true)}>Resolve conflict</button></div>
    </section>}
    {state.conflict && conflictOpen && <ConflictDialog revision={state.conflict.revision} busy={resolving} onClose={() => setConflictOpen(false)} onResolve={(mode) => { void resolve(mode) }} />}
    <div className={`markdown-editor-panes markdown-layout-${layout}`}>
      <section className="markdown-source-pane" aria-label="Source pane"><h2>Source</h2><MarkdownSource ref={sourceRef} session={session} readOnly={readOnly || !!state.recovery || resolving} suggest={(query) => documentsApi.suggest(query)} /></section>
      <section className="markdown-preview-pane" aria-label="Preview pane"><h2>Preview</h2><div ref={previewRef} onScroll={() => syncScroll('preview')}><MarkdownPreview markdown={markdown} targets={targets} /></div></section>
    </div>
    <footer className="markdown-status-bar"><span>{words} words · {characters} characters · {markdown.split('\n').length} lines</span><span>{state.status === 'saved' ? 'All changes saved' : statusLabels[state.status]}</span></footer>
  </>
}

export default function MarkdownEditor({ metadata: initialMetadata }: { metadata: DocumentWithAbilities }) {
  const { user, logout } = useAuth()
  const [metadata, setMetadata] = useState(initialMetadata)
  useEffect(() => setMetadata(initialMetadata), [initialMetadata.id])
  const [session, setSession] = useState<LocalMarkdownSession | CollabMarkdownSession | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)
  const readOnly = metadata.abilities.canEdit === false
  const navigate = useNavigate()
  const sessionRef = useRef(session); sessionRef.current = session
  const refresh = async (reset = false) => {
    try {
      const next = await documentsApi.getMetadata(initialMetadata.id)
      setMetadata(next)
      if (reset) setAttempt((value) => value + 1)
    } catch (reason) {
      if (reason instanceof Error && reason.message === 'Unauthorized') logout()
      sessionRef.current?.destroy()
      navigate('/markdown', { replace: true, state: { notice: 'Access to this document was removed or it is no longer available.' } })
    }
  }
  useMarkdownNotifications((notice) => {
    if (notice.docId && notice.docId !== initialMetadata.id) return
    if (notice.type === 'access-revoked') {
      sessionRef.current?.destroy()
      navigate('/markdown', { replace: true, state: { notice: 'Access to this document was removed.' } })
    } else if (['connected', 'document-shared', 'document-metadata-changed'].includes(notice.type)) void refresh(notice.type === 'document-shared')
  })

  useEffect(() => {
    if (!user) return
    let active = true
    let current: LocalMarkdownSession | CollabMarkdownSession | null = null
    const controller = new AbortController()
    const token = getToken()
    const transport = createMarkdownTransport(metadata.id, token)
    setSession(null)
    setError('')
    transport.load(controller.signal).then(async (initial) => {
      if (!active) return
      current = initial.collaborationEnabled ? await CollabMarkdownSession.create({ docId: metadata.id, user, initial, readOnly, signal: controller.signal, onAccessChanged: () => { void refresh(true) } }) : new LocalMarkdownSession({
        docId: metadata.id, userId: user.id, initial, transport, readOnly,
        isAuthorized: () => getToken() === token && !!token,
        onUnauthorized: logout,
      })
      if (active) setSession(current); else current.destroy()
    }).catch((reason: unknown) => {
      if (!active) return
      if (reason instanceof MarkdownApiError && reason.status === 401) logout()
      setError(reason instanceof Error ? reason.message : 'Unable to load Markdown.')
    })
    return () => { active = false; controller.abort(); current?.destroy() }
  }, [metadata.id, user?.id, attempt, readOnly, metadata.collaborationEnabled, logout])

  return <div className="docs-shell markdown-workspace markdown-editor-shell">
    <header className="topbar"><div className="topbar-left">
      <AppMenu current="markdown-editor" />
      <Link className="back-btn" to="/markdown" aria-label="Back to Markdown documents">←</Link>
      <h1 className="markdown-editor-title">{metadata.name}</h1>
    </div>{metadata.abilities.canShare && <button type="button" className="new-doc-btn" onClick={() => setShareOpen(true)}>Share</button>}</header>
    {shareOpen && metadata.abilities.canShare && <Suspense fallback={<p role="status">Loading sharing…</p>}><ShareModal docId={metadata.id} editorType="markdown" canShare onClose={() => setShareOpen(false)} /></Suspense>}
    <main className="markdown-editor-main">
      {session ? <><EditorSession key={metadata.id} session={session} readOnly={readOnly} docId={metadata.id} initialTitle={metadata.name} initialTags={metadata.tags ?? []} /><BacklinksPanel docId={metadata.id} onNavigate={(id) => navigate(`/markdown/${encodeURIComponent(id)}`)} /></>
        : error ? <section className="route-status"><h2>Unable to load Markdown</h2><p role="alert">{error}</p><button type="button" className="new-doc-btn" onClick={() => setAttempt((value) => value + 1)}>Try again</button></section>
          : <p className="route-status" role="status">Loading Markdown…</p>}
    </main>
  </div>
}
