import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AppMenu from '../AppMenu'

/** Route shell for C1/C2; the document gallery and creation flow are implemented in C4. */
export default function MarkdownHome() {
  const { user, logout } = useAuth()

  return (
    <div className="docs-shell markdown-workspace">
      <header className="docs-header">
        <div className="docs-brand">
          <AppMenu current="markdown" />
          <span className="docs-brand-name">NexaDoc</span>
        </div>
        <div className="docs-header-actions">
          <div className="search-box">
            <input type="search" className="search-input" placeholder="Search Markdown…" aria-label="Search Markdown" aria-describedby="markdown-availability" readOnly />
          </div>
          <button type="button" className="new-doc-btn" disabled title="Markdown document creation will be available soon.">New document</button>
          <button type="button" className="logout-btn" onClick={logout}>Sign out</button>
          <div className="avatar" title={user?.username} style={{ background: user?.avatarColor }}>
            {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
          </div>
        </div>
      </header>
      <main className="docs-main">
        <section className="workspace-placeholder" aria-labelledby="markdown-heading">
          <span className="workspace-label">Markdown</span>
          <h1 id="markdown-heading">Your Markdown workspace</h1>
          <p id="markdown-availability" role="status">
            Markdown documents and editing will be available soon.
          </p>
          <Link className="new-doc-btn" to="/">Open Docs</Link>
        </section>
      </main>
    </div>
  )
}
