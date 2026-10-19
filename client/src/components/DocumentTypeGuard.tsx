import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { documentsApi, type DocumentWithAbilities } from '../services/api'
import type { EditorType } from '../types'
import AppMenu from './AppMenu'

interface DocumentTypeGuardProps {
  expectedType: EditorType
  children: (metadata: DocumentWithAbilities) => ReactNode
}

interface DocumentLoad {
  id: string
  metadata?: DocumentWithAbilities
  error?: string
}

/** Resolve the document before mounting an editor or opening its collaboration socket. */
export default function DocumentTypeGuard({ expectedType, children }: DocumentTypeGuardProps) {
  const { id = '' } = useParams<{ id: string }>()
  const location = useLocation()
  const { logout } = useAuth()
  const [load, setLoad] = useState<DocumentLoad | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoad(null)
    documentsApi.getMetadata(id).then((metadata) => {
      if (!cancelled) setLoad({ id, metadata })
    }).catch((error: unknown) => {
      if (cancelled) return
      if (error instanceof Error && error.message === 'Unauthorized') logout()
      setLoad({ id, error: 'Unable to open document' })
    })
    return () => { cancelled = true }
  }, [id, attempt, logout])

  if (!load || load.id !== id) {
    return <div className="route-status" role="status">Opening document…</div>
  }

  const metadata = load.metadata
  const type = metadata?.editorType ?? 'rich'
  if (load.error || !metadata || (type !== 'rich' && type !== 'markdown')) {
    return (
      <main className="route-status">
        <AppMenu current={expectedType === 'markdown' ? 'markdown-editor' : 'doc-editor'} />
        <h1>Unable to open document</h1>
        <p>The document may be unavailable, or you may not have access.</p>
        <button type="button" className="new-doc-btn" onClick={() => { setLoad(null); setAttempt((value) => value + 1) }}>Try again</button>
        <Link to={expectedType === 'markdown' ? '/markdown' : '/'}>Back to documents</Link>
      </main>
    )
  }

  if (type !== expectedType) {
    return <Navigate
      replace
      to={{
        pathname: `${type === 'markdown' ? '/markdown/' : '/document/'}${encodeURIComponent(id)}`,
        search: location.search,
        hash: location.hash,
      }}
      state={location.state}
    />
  }

  return <>{children(metadata)}</>
}
