import { useState, useEffect } from 'react'
import { snapshotsApi } from '../services/api'
import * as Y from 'yjs'
import type { Editor } from '@tiptap/react'
import type { SnapshotMeta } from '../types'

interface Props
{
  docId: string
  ydoc: Y.Doc
  /** 当前 TipTap 实例——保存快照时取正文，恢复时写回正文 */
  editor: Editor | null
  canViewHistory: boolean
  onClose: () => void
}

/**
 * 从 Yjs 文档里抽取纯文本预览。
 * TipTap 的 Collaboration 扩展默认使用名为 'default' 的 XmlFragment 存正文
 * （之前读的是 `ydoc.getText('tiptap')`——那个 Y.Text 根本不存在，所以 preview 永远是空）。
 */
function extractPreview(ydoc: Y.Doc, maxLength = 200): string
{
  const fragment = ydoc.getXmlFragment('default')
  return fragment
    .toString()
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export default function VersionHistoryModal({ docId, ydoc, editor, canViewHistory, onClose }: Props)
{
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() =>
  {
    if (!canViewHistory) {
      setError('You do not have permission to view version history')
      setLoading(false)
      return
    }
    loadSnapshots()
  }, [docId, canViewHistory])

  const loadSnapshots = async () =>
  {
    try {
      const list = await snapshotsApi.list(docId)
      setSnapshots(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots')
    } finally {
      setLoading(false)
    }
  }

  const createSnapshot = async () =>
  {
    const snapshotName = name.trim() || `Revision ${new Date().toLocaleString()}`
    if (!editor) return
    try {
      const preview = extractPreview(ydoc)
      // 正文以 TipTap JSON 形式一并保存：恢复时必须靠它做「删除旧内容 + 插入快照内容」
      // （只存 Yjs 状态是回不去的——Yjs 的更新只能合并、不能撤销）
      const content = JSON.stringify(editor.getJSON())
      await snapshotsApi.create(docId, snapshotName, preview, content)
      setName('')
      await loadSnapshots()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create snapshot')
    }
  }

  const restoreSnapshot = async (snapshotId: string) =>
  {
    if (!confirm('Restore this version? Current content will be replaced.')) return
    if (!editor) return
    setRestoring(snapshotId)
    try {
      const { contentJson } = await snapshotsApi.restore(docId, snapshotId)
      if (!contentJson) {
        setError('这个快照是旧格式（创建时没有保存正文），无法恢复')
        return
      }
      // 走一次正常的编辑事务：Collaboration 扩展会把它翻译成
      // 「删除当前内容 + 插入快照内容」的 Yjs 操作，所有协作者同步回滚。
      // emitUpdate 必须显式传 true（默认 false）。
      editor.commands.setContent(JSON.parse(contentJson), true)
      setError('')
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
