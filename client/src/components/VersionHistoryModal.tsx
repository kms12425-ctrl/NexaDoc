import { useState, useEffect } from 'react'
import { snapshotsApi } from '../services/api'
import * as Y from 'yjs'
import type { SnapshotMeta } from '../types'

interface Props {
  docId: string
  ydoc: Y.Doc
  canViewHistory: boolean
  onClose: () => void
}

export default function VersionHistoryModal({ docId, ydoc, canViewHistory, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    if (!canViewHistory) {
      setError('You do not have permission to view version history')
      setLoading(false)
      return
    }
    loadSnapshots()
  }, [docId, canViewHistory])

  const loadSnapshots = async () => {
    try {
      const list = await snapshotsApi.list(docId)
      setSnapshots(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots')
    } finally {
      setLoading(false)
    }
  }

  const createSnapshot = async () => {
    const snapshotName = name.trim() || `Revision ${new Date().toLocaleString()}`
    try {
      const preview = ydoc.getText('tiptap').toString().slice(0, 200)
      await snapshotsApi.create(docId, snapshotName, preview)
      setName('')
      await loadSnapshots()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create snapshot')
    }
  }

  const restoreSnapshot = async (snapshotId: string) => {
    if (!confirm('Restore this version? Current content will be replaced.')) return
    setRestoring(snapshotId)
    try {
      const { crdtState } = await snapshotsApi.restore(docId, snapshotId)
      // Apply the restored state to the Yjs document
      const state = new Uint8Array(crdtState)
      Y.applyUpdate(ydoc, state)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore snapshot')
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Version history">
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <h2 className="modal-title">Version history</h2>
          <button className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {canViewHistory && (
          <div className="snapshot-create">
            <input
              type="text"
              className="modal-input"
              placeholder="Snapshot name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
            <button className="modal-create" onClick={createSnapshot}>Save version</button>
          </div>
        )}

        {loading ? (
          <p className="modal-subtitle">Loading…</p>
        ) : snapshots.length === 0 ? (
          <p className="modal-subtitle">No saved versions yet. Create a snapshot to preserve the current state.</p>
        ) : (
          <div className="snapshot-list">
            {snapshots.map((snap) => (
              <div key={snap._id} className="snapshot-item">
                <div className="snapshot-info">
                  <div className="snapshot-name">{snap.name}</div>
                  <div className="snapshot-meta">
                    by {snap.authorName} · {new Date(snap.createdAt).toLocaleString()}
                  </div>
                  {snap.preview && (
                    <div className="snapshot-preview">{snap.preview.slice(0, 100)}…</div>
                  )}
                </div>
                <button
                  className="snapshot-restore-btn"
                  onClick={() => restoreSnapshot(snap._id)}
                  disabled={restoring === snap._id}
                >
                  {restoring === snap._id ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
