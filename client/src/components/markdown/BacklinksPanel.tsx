import { useEffect, useState } from 'react'
import { documentsApi } from '../../services/api'

export default function BacklinksPanel({ docId, onNavigate }: { docId: string; onNavigate: (id: string) => void }) {
  const [data, setData] = useState<{ outgoing: Array<{ title: string; targetDocId: string | null }>; backlinks: Array<{ id: string; title: string }> } | null>(null)
  useEffect(() => { let active = true; documentsApi.getLinks(docId).then((value) => { if (active) setData(value) }).catch(() => { if (active) setData({ outgoing: [], backlinks: [] }) }); return () => { active = false } }, [docId])
  if (!data) return <p className="markdown-links-panel">Loading links…</p>
  return <aside className="markdown-links-panel" aria-label="Document links"><strong>Links</strong><div><span>Outgoing</span>{data.outgoing.length ? data.outgoing.map((link) => link.targetDocId ? <button key={link.title} type="button" onClick={() => onNavigate(link.targetDocId!)}>{link.title}</button> : <span key={link.title}>{link.title} (unresolved)</span>) : <em>None</em>}</div><div><span>Backlinks</span>{data.backlinks.length ? data.backlinks.map((link) => <button key={link.id} type="button" onClick={() => onNavigate(link.id)}>{link.title}</button>) : <em>None</em>}</div></aside>
}
