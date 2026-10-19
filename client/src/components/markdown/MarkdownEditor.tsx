import { Link } from 'react-router-dom'
import type { DocumentWithAbilities } from '../../services/api'
import AppMenu from '../AppMenu'

/** The guarded route is ready for the Markdown editor implementation. */
export default function MarkdownEditor({ metadata }: { metadata: DocumentWithAbilities }) {
  return (
    <div className="docs-shell markdown-workspace">
      <header className="topbar">
        <div className="topbar-left">
          <AppMenu current="markdown-editor" />
          <Link className="back-btn" to="/markdown" aria-label="Back to Markdown documents">←</Link>
          <span className="docs-brand-name">{metadata.name}</span>
        </div>
      </header>
      <main className="docs-main">
        <section className="workspace-placeholder">
          <span className="workspace-label">Markdown</span>
          <h1>{metadata.name}</h1>
          <p role="status">Markdown editing will be available soon.</p>
          <Link className="new-doc-btn" to="/markdown">Back to Markdown</Link>
        </section>
      </main>
    </div>
  )
}
