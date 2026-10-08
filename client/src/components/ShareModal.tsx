import { useState, useEffect, useCallback } from 'react'
import { sharingApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Role } from '../types'
import type { DocumentAccess } from '../types'

interface Props {
  docId: string
  canShare: boolean
  onClose: () => void
}

export default function ShareModal({ docId, canShare, onClose }: Props) {
  const { user } = useAuth()
  const [accessList, setAccessList] = useState<DocumentAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<string>(Role.READER)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadAccess()
  }, [docId])

  const loadAccess = async () => {
    try {
      const list = await sharingApi.listAccess(docId)
      setAccessList(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collaborators')
    } finally {
      setLoading(false)
    }
  }

  const share = async () => {
    const target = username.trim()
    if (!target) return
    try {
      await sharingApi.share(docId, target, role)
      setUsername('')
      await loadAccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share')
    }
  }

  const removeAccess = async (userId: string) => {
    if (!confirm('Remove this collaborator?')) return
    try {
      await sharingApi.removeAccess(docId, userId)
      await loadAccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  const copyLink = useCallback(async () => {
    const link = `${window.location.origin}/document/${docId}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = link
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [docId])

  const roleLabels: Record<string, string> = {
    [Role.OWNER]: 'Owner',
    [Role.ADMIN]: 'Admin',
    [Role.EDITOR]: 'Editor',
    [Role.COMMENTER]: 'Commenter',
    [Role.READER]: 'Reader',
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Share document">
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <h2 className="modal-title">Share document</h2>
          <button className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {canShare && (
          <div className="share-form">
            <input
              type="text"
              className="modal-input"
              placeholder="Username to invite"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
            />
            <select className="share-role-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value={Role.READER}>Reader</option>
              <option value={Role.COMMENTER}>Commenter</option>
              <option value={Role.EDITOR}>Editor</option>
              <option value={Role.ADMIN}>Admin</option>
            </select>
            <button className="modal-create" onClick={share} disabled={!username.trim()}>
              Invite
            </button>
          </div>
        )}

        <div className="share-link-row">
          <input
            type="text"
            className="modal-input share-link-input"
            readOnly
            value={`${window.location.origin}/document/${docId}`}
            onClick={copyLink}
          />
          <button className="share-copy-btn" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        {loading ? (
          <p className="modal-subtitle">Loading…</p>
        ) : (
          <div className="access-list">
            {accessList.map((a) => (
              <div key={a._id || a.userId} className="access-item">
                <div className="access-avatar">
                  {(a.username[0] || 'U').toUpperCase()}
                </div>
                <div className="access-info">
                  <div className="access-name">
                    {a.username}
                    {a.userId === user?.id && <span className="access-you"> (you)</span>}
                  </div>
                  <div className="access-role">{roleLabels[a.role] || a.role}</div>
                </div>
                {canShare && a.role !== Role.OWNER && (
                  <button
                    className="access-remove-btn"
                    onClick={() => removeAccess(a.userId)}
                    title="Remove collaborator"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
