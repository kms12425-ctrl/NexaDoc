import { useState, useEffect, useRef } from 'react'
import { commentsApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { Comment } from '../types'

interface Props {
  docId: string
  canComment: boolean
  onClose: () => void
}

export default function CommentPanel({ docId, canComment, onClose }: Props) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newComment, setNewComment] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadComments()
  }, [docId])

  const loadComments = async () => {
    try {
      const list = await commentsApi.list(docId)
      setComments(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  const addComment = async () => {
    const body = newComment.trim()
    if (!body) return
    try {
      await commentsApi.create(docId, body)
      setNewComment('')
      await loadComments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment')
    }
  }

  const resolveComment = async (commentId: string) => {
    try {
      await commentsApi.resolve(docId, commentId)
      await loadComments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve comment')
    }
  }

  const open = comments.filter((c) => !c.resolved)
  const resolved = comments.filter((c) => c.resolved)

  return (
    <div className="comment-panel">
      <div className="comment-panel-header">
        <h3>Comments</h3>
        <button className="modal-close-x" onClick={onClose} aria-label="Close comments">×</button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {canComment && (
        <div className="comment-form">
          <textarea
            ref={inputRef}
            className="comment-input"
            placeholder="Write a comment…"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            maxLength={2000}
          />
          <button className="comment-submit" onClick={addComment} disabled={!newComment.trim()}>
            Comment
          </button>
        </div>
      )}

      {loading ? (
        <p className="modal-subtitle">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="comment-empty">No comments yet. {canComment && 'Be the first to comment.'}</p>
      ) : (
        <div className="comment-list">
          {open.length > 0 && (
            <>
              {open.length > 0 && <div className="comment-section-label">Open ({open.length})</div>}
              {open.map((c) => (
                <CommentItem
                  key={c._id}
                  comment={c}
                  isOwn={c.userId === user?.id}
                  onResolve={() => resolveComment(c._id)}
                  canResolve={canComment}
                />
              ))}
            </>
          )}
          {resolved.length > 0 && (
            <>
              <div className="comment-section-label">Resolved ({resolved.length})</div>
              {resolved.map((c) => (
                <CommentItem
                  key={c._id}
                  comment={c}
                  isOwn={c.userId === user?.id}
                  onResolve={() => resolveComment(c._id)}
                  canResolve={canComment}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CommentItem({
  comment,
  isOwn,
  onResolve,
  canResolve,
}: {
  comment: Comment
  isOwn: boolean
  onResolve: () => void
  canResolve: boolean
}) {
  return (
    <div className={`comment-item ${comment.resolved ? 'resolved' : ''}`}>
      <div className="comment-avatar">
        {(comment.authorName[0] || 'U').toUpperCase()}
      </div>
      <div className="comment-body">
        <div className="comment-author">
          {comment.authorName}
          {isOwn && <span className="comment-you"> (you)</span>}
          <span className="comment-time">· {new Date(comment.createdAt).toLocaleString()}</span>
        </div>
        <div className="comment-text">{comment.body}</div>
        {!comment.resolved && canResolve && (
          <button className="comment-resolve-btn" onClick={onResolve}>
            Resolve
          </button>
        )}
        {comment.resolved && <span className="comment-resolved-tag">Resolved</span>}
      </div>
    </div>
  )
}
