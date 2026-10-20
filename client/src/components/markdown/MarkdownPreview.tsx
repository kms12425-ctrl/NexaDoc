import { Component, memo, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import remarkWikiLink from '../../markdown/remarkWikiLink'

const EMPTY_TARGETS: ReadonlyMap<string, string | null> = new Map()
const plugins = [remarkGfm, remarkWikiLink]

class PreviewBoundary extends Component<{ markdown: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidUpdate(previous: { markdown: string }) {
    if (this.state.failed && previous.markdown !== this.props.markdown) this.setState({ failed: false })
  }
  render() { return this.state.failed ? <p role="alert">Unable to render this preview. Your source is still available.</p> : this.props.children }
}

function MarkdownPreview({ markdown, targets = EMPTY_TARGETS }: { markdown: string; targets?: ReadonlyMap<string, string | null> }) {
  const [debounced, setDebounced] = useState(markdown)
  useEffect(() => { const timer = setTimeout(() => setDebounced(markdown), 80); return () => clearTimeout(timer) }, [markdown])
  const deferred = useDeferredValue(debounced)
  const components = useMemo<Components>(() => ({
    a: ({ node, href, children }) => {
      const wikiTitle = node?.properties['data-wiki-title']
      if (typeof wikiTitle === 'string') {
        const id = targets.get(wikiTitle)
        return <Link className={`wiki-link${id ? '' : ' wiki-link-unresolved'}`} to={id ? `/markdown/${encodeURIComponent(id)}` : `/markdown?q=${encodeURIComponent(wikiTitle)}`} title={id ? `Open ${wikiTitle}` : `Find ${wikiTitle}`}>{children}</Link>
      }
      const external = /^(?:https?:)?\/\//i.test(href ?? '')
      return <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>
    },
    img: ({ src, alt, title }) => <img src={src} alt={alt ?? ''} title={title} loading="lazy" />,
  }), [targets])

  return <div className="markdown-preview" aria-label="Markdown preview" role="region">
    {!deferred.trim() ? <p className="markdown-preview-placeholder">Start typing to see the preview.</p>
      : <PreviewBoundary markdown={deferred}><ReactMarkdown remarkPlugins={plugins} components={components} skipHtml>{deferred}</ReactMarkdown></PreviewBoundary>}
  </div>
}

export default memo(MarkdownPreview)
