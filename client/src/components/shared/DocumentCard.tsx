import type { ReactNode } from 'react'
import type { DocumentMeta } from '../../types'

interface DocumentCardProps {
  doc: DocumentMeta
  shared?: boolean
  preview: ReactNode
  tags?: readonly string[]
  snippet?: ReactNode
  onOpen: () => void
  onDelete?: () => void
}

const CARD_COLORS = [
  '#4285f4', '#ea4335', '#34a853', '#fbbc04',
  '#ff6d00', '#aa00ff', '#00acc1', '#e91e63',
]

function cardColor(id: string): string {
  if (!id) return CARD_COLORS[0]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length]
}

function timeAgo(timestamp: number): string {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** The parent supplies the preview and actions for each document type. */
export default function DocumentCard({
  doc, shared = false, preview, tags = [], snippet, onOpen, onDelete,
}: DocumentCardProps) {
  return (
    <article
      className={`doc-card${shared ? ' shared-card' : ''}`}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(event) => {
        // Buttons inside the card handle their own keyboard activation.
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      aria-label={`Open document: ${doc.name}`}
    >
      <div className="doc-card-preview" style={{ borderTop: `4px solid ${cardColor(doc.id)}` }}>
        {preview}
      </div>

      <div className="doc-card-body">
        <div className="doc-card-name" title={doc.name}>{doc.name}</div>
        {tags.length > 0 && (
          <div className="doc-card-tags">
            {tags.map((tag) => <span key={tag} className="doc-card-tag">#{tag}</span>)}
          </div>
        )}
        {snippet && <p className="doc-card-snippet">{snippet}</p>}
        <div className="doc-card-meta">
          {!shared && <span className="doc-card-id">{doc.id.slice(0, 12)}…</span>}
          <span className="doc-card-time">{timeAgo(doc.updatedAt)}</span>
        </div>
      </div>

      {onDelete && (
        <button
          type="button"
          className="doc-delete-btn"
          onClick={(event) => { event.stopPropagation(); onDelete() }}
          title="Delete document"
          aria-label={`Delete ${doc.name}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      )}
    </article>
  )
}
