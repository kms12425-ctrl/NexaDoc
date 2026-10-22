import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isMarkdownApiEnabled, markdownDocumentsApi, type MarkdownDocumentMeta } from '../../services/markdownDocuments'
import { documentsApi } from '../../services/api'
import type { MarkdownTemplate } from '../../templates/markdown'
import AppMenu from '../AppMenu'
import DocumentCard from '../shared/DocumentCard'
import CreateDocModal from '../shared/CreateDocModal'
import MarkdownTemplateGallery from './MarkdownTemplateGallery'
import MarkdownTemplatePicker from './MarkdownTemplatePicker'
import TagFilter from './TagFilter'

export default function MarkdownHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const selectedTag = params.get('tag') ?? ''
  const enabled = isMarkdownApiEnabled()
  const [documents, setDocuments] = useState<MarkdownDocumentMeta[]>([])
  const [loading, setLoading] = useState(enabled)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<MarkdownTemplate | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MarkdownDocumentMeta | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [tagCounts, setTagCounts] = useState<Array<{ tag: string; count: number }>>([])
  const mountedRef = useRef(false)
  const creatingRef = useRef(false)
  const deletingRef = useRef(false)
  const deleteCancelRef = useRef<HTMLButtonElement>(null)
  const deleteModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let active = true
    setLoading(true)
    setLoadError('')
    markdownDocumentsApi.list().then((result) => {
      if (active) setDocuments(result)
    }).catch((error: unknown) => {
      if (!active) return
      if (error instanceof Error && error.message === 'Unauthorized') logout()
      setLoadError(error instanceof Error ? error.message : 'Unable to load Markdown documents.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [enabled, attempt, logout])
  useEffect(() => { if (!enabled) return; documentsApi.listTags().then(setTagCounts).catch(() => setTagCounts([])) }, [enabled, attempt])

  useEffect(() => {
    if (!deleteTarget) return
    const previousFocus = document.activeElement
    deleteCancelRef.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [deleteTarget])

  const chooseTemplate = (template: MarkdownTemplate) => {
    setPendingTemplate(template)
    setName(template.category === 'blank' ? '' : template.name)
    setCreateError('')
    setPickerOpen(false)
  }

  const closeNaming = () => {
    if (creatingRef.current) return
    setPendingTemplate(null)
    setName('')
    setCreateError('')
  }

  const confirmCreate = async () => {
    if (!pendingTemplate || !enabled || creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setCreateError('')
    const title = name.trim() || (pendingTemplate.category === 'blank' ? 'Untitled document' : pendingTemplate.name)
    try {
      const document = await markdownDocumentsApi.create(title, pendingTemplate.markdown)
      if (!mountedRef.current) return
      setPendingTemplate(null)
      setName('')
      navigate('/markdown/' + encodeURIComponent(document.id))
    } catch (error) {
      if (!mountedRef.current) return
      if (error instanceof Error && error.message === 'Unauthorized') logout()
      setCreateError(error instanceof Error ? error.message : 'Unable to create document.')
    } finally {
      creatingRef.current = false
      if (mountedRef.current) setCreating(false)
    }
  }

  const closeDelete = () => {
    if (deletingRef.current) return
    setDeleteTarget(null)
    setDeleteError('')
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deletingRef.current) return
    const id = deleteTarget.id
    deletingRef.current = true
    setDeleting(true)
    setDeleteError('')
    try {
      await markdownDocumentsApi.remove(id)
      if (!mountedRef.current) return
      setDocuments((current) => current.filter((document) => document.id !== id))
      setDeleteTarget(null)
    } catch (error) {
      if (!mountedRef.current) return
      if (error instanceof Error && error.message === 'Unauthorized') logout()
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete document.')
    } finally {
      deletingRef.current = false
      if (mountedRef.current) setDeleting(false)
    }
  }

  const setQuery = (value: string) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (value) next.set('q', value)
    else next.delete('q')
    return next
  }, { replace: true })
  const [searchResults, setSearchResults] = useState<MarkdownDocumentMeta[] | null>(null)
  useEffect(() => {
    if (!enabled || (!query.trim() && !selectedTag)) {
      setSearchResults(null)
      return
    }

    const timer = setTimeout(() => {
      documentsApi.searchMarkdown(query, selectedTag)
        .then((result) => setSearchResults(result
          .filter((item) => item.editorType === 'markdown')
          .map(({ snippet: _snippet, highlights: _highlights, ...item }) => ({ ...item, editorType: 'markdown' as const })),
        ))
        .catch(() => setSearchResults([]))
    }, 180)

    return () => clearTimeout(timer)
  }, [enabled, query, selectedTag])
  const visibleDocuments = searchResults ?? documents.filter((document) => (!selectedTag || document.tags?.some((tag) => tag.toLocaleLowerCase() === selectedTag.toLocaleLowerCase())) && document.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const setTag = (tag: string) => setParams((current) => { const next = new URLSearchParams(current); if (tag) next.set('tag', tag); else next.delete('tag'); return next }, { replace: true })

  return (
    <div className="docs-shell markdown-workspace">
      <header className="docs-header">
        <div className="docs-brand">
          <AppMenu current="markdown" />
          <svg className="brand-icon-lg" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="8" fill="#1a73e8" />
            <path d="M10 10h14l6 6v14H10V10z" fill="white" opacity="0.9" />
            <path d="M24 10v6h6" stroke="#1a73e8" strokeWidth="1.5" />
            <path d="M14 25V18l3 4 3-4v7M24 18v7m-2-2 2 2 2-2" stroke="#1a73e8" strokeWidth="1.5" />
          </svg>
          <span className="docs-brand-name">NexaDoc</span>
        </div>
        <div className="docs-header-actions">
          <div className="user-badge" title={user?.username}>
            <div className="avatar" style={{ background: user?.avatarColor || '#1a73e8' }}>{(user?.displayName || user?.username || 'U')[0].toUpperCase()}</div>
            <span className="user-name">{user?.displayName || user?.username}</span>
          </div>
          <button type="button" className="logout-btn" onClick={logout}>Sign out</button>
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="search" className="search-input" placeholder="Search Markdown titles…" aria-label="Search Markdown" aria-describedby="markdown-search-help" readOnly={!enabled} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setQuery('') }} />
          </div>
          <button type="button" className="new-doc-btn" onClick={() => setPickerOpen(true)}><span aria-hidden="true">＋</span>New document</button>
        </div>
      </header>
      <main className="docs-main">
        <h1 className="visually-hidden">Your Markdown workspace</h1>
        <p id="markdown-search-help" className="visually-hidden">Search documents by title.</p>
        {!enabled && <p className="docs-info-banner" role="status">Markdown document creation and storage are not available yet. You can explore the templates below.</p>}
        <MarkdownTemplateGallery onSelect={chooseTemplate} />
        <TagFilter items={tagCounts} selected={selectedTag} onSelect={setTag} />
        <div className="section-divider" />
        <section className="recent-section" aria-label="My Markdown documents">
          <h2 className="section-label">{query.trim() ? 'Search results' : 'My documents'}<span className="doc-count">{visibleDocuments.length}</span></h2>
          {loading ? <p className="docs-loading" role="status">Loading Markdown documents…</p>
            : loadError ? <div className="docs-error-banner" role="alert"><p>{loadError}</p><button type="button" className="modal-cancel" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>
              : visibleDocuments.length === 0 ? <div className="empty-state">
                <span className="markdown-empty-icon" aria-hidden="true">M↓</span>
                <h3>{query.trim() ? 'No documents found' : 'No documents yet'}</h3>
                <p>{query.trim() ? 'Try a different title.' : enabled ? 'Choose a template to create your first Markdown document.' : 'Explore the templates while Markdown storage is being prepared.'}</p>
                {!query.trim() && <button type="button" className="new-doc-btn" onClick={() => setPickerOpen(true)}>{enabled ? 'Create document' : 'Browse templates'}</button>}
              </div> : <div className="docs-grid">
                {visibleDocuments.map((document) => <DocumentCard
                  key={document.id} doc={document} tags={document.tags} snippet={document.snippet}
                  preview={<div className="markdown-document-preview" aria-hidden="true"><span>M↓</span><strong>{document.name}</strong>{document.snippet && <p>{document.snippet}</p>}</div>}
                  onOpen={() => navigate('/markdown/' + encodeURIComponent(document.id))}
                  onDelete={document.abilities?.canDelete === true ? () => { setDeleteTarget(document); setDeleteError('') } : undefined}
                />)}
              </div>}
        </section>
      </main>
      {pickerOpen && <MarkdownTemplatePicker onSelect={chooseTemplate} onClose={() => setPickerOpen(false)} />}
      {pendingTemplate && <CreateDocModal
        value={name} placeholder={pendingTemplate.category === 'blank' ? 'Untitled document' : pendingTemplate.name}
        description={pendingTemplate.category === 'blank' ? 'Give your Markdown document a name to get started.' : `Starting from the "${pendingTemplate.name}" template.`}
        onChange={setName} onConfirm={confirmCreate} onClose={closeNaming}
        submitting={creating} disabled={!enabled} error={!enabled ? 'Markdown document creation is not available yet.' : createError}
      />}
      {deleteTarget && <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm delete" onClick={closeDelete} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeDelete() }
        if (event.key === 'Tab') {
          const controls = Array.from(deleteModalRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
          if (!controls.length) { event.preventDefault(); return }
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }
      }}>
        <div ref={deleteModalRef} className="modal" onClick={(event) => event.stopPropagation()}>
          <h2 className="modal-title">Delete document?</h2>
          <p className="modal-subtitle">Delete "<strong>{deleteTarget.name}</strong>" from your documents?</p>
          {deleteError && <p className="modal-error" role="alert">{deleteError}</p>}
          <div className="modal-actions">
            <button ref={deleteCancelRef} type="button" className="modal-cancel" disabled={deleting} onClick={closeDelete}>Cancel</button>
            <button type="button" className="modal-delete" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
