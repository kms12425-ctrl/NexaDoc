import { useEffect, useRef, useState } from 'react'
import { documentsApi, type DocumentWithAbilities } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

function cleanTag(value: string) { return value.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim() }

export default function MarkdownMetadata({ metadata, readOnly, onSaved }: {
  metadata: DocumentWithAbilities
  readOnly: boolean
  onSaved: (value: { name: string; tags: string[] }) => void
}) {
  const { logout } = useAuth()
  const [title, setTitle] = useState(metadata.name)
  const [tags, setTags] = useState(metadata.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const active = useRef(true)
  const saving = useRef(false)
  const composing = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  async function save(patch: { title?: string; tags?: string[] }) {
    if (readOnly || saving.current) return false
    saving.current = true; setBusy(true); setError(''); setMessage('Saving details…')
    try {
      const updated = await documentsApi.updateMetadata(metadata.id, patch)
      if (!active.current) return false
      if (patch.title !== undefined) setTitle(updated.name)
      setTags(updated.tags ?? [])
      onSaved({ name: updated.name, tags: updated.tags ?? [] })
      setMessage('Details saved')
      return true
    } catch (reason) {
      if (!active.current) return false
      const text = reason instanceof Error ? reason.message : 'Unable to save details'
      if (text === 'Unauthorized') logout()
      setError(text); setMessage('')
      return false
    } finally {
      saving.current = false
      if (active.current) setBusy(false)
    }
  }

  function addTag() {
    if (composing.current || readOnly || busy) return
    const tag = cleanTag(tagInput)
    if (!tag || tag.length > 30) { setError('Enter a tag with 1–30 characters.'); return }
    if (tags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) { setError('This tag already exists.'); return }
    if (tags.length >= 20) { setError('A document can have at most 20 tags.'); return }
    void save({ tags: [...tags, tag] }).then((saved) => { if (saved && active.current) setTagInput('') })
  }

  return <section className="markdown-metadata" aria-label="Document details">
    <form className="markdown-title-form" onSubmit={(event) => {
      event.preventDefault()
      if (composing.current || readOnly || busy) return
      if (!title.trim() || title.trim().length > 120) { setError('Enter a title with 1–120 characters.'); return }
      void save({ title: title.trim() })
    }}>
      <label htmlFor="markdown-title">Document title</label>
      <input id="markdown-title" value={title} maxLength={120} readOnly={readOnly} disabled={busy} onChange={(event) => { setTitle(event.target.value); setMessage('') }}
        onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} onKeyDown={(event) => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current)) event.preventDefault() }} />
      {!readOnly && <button type="submit" disabled={busy || title.trim() === metadata.name}>Save title</button>}
    </form>
    <div className="markdown-tag-list" aria-label="Document tags">
      {tags.length ? tags.map((tag) => <span className="markdown-tag" key={tag}>{tag}{!readOnly && <button type="button" aria-label={`Remove tag ${tag}`} disabled={busy} onClick={() => { void save({ tags: tags.filter((item) => item !== tag) }) }}>×</button>}</span>) : <span className="markdown-no-tags">No tags</span>}
    </div>
    {!readOnly && <form className="markdown-tag-form" onSubmit={(event) => { event.preventDefault(); addTag() }}>
      <label htmlFor="markdown-new-tag">Add tag</label>
      <input id="markdown-new-tag" value={tagInput} disabled={busy} placeholder="Tag (max 30 characters)" onChange={(event) => { setTagInput(event.target.value); setMessage('') }}
        onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} onKeyDown={(event) => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current)) event.preventDefault() }} />
      <button type="submit" disabled={busy || !tagInput.trim() || tags.length >= 20}>Add tag</button><span>{tags.length}/20 tags</span>
    </form>}
    {message && <p className="markdown-metadata-message" aria-live="polite">{message}</p>}
    {error && <p role="alert">{error} Changes were not saved. You can retry.</p>}
  </section>
}
