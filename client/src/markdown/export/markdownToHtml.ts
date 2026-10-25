import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkWikiLink from '../remarkWikiLink'

/**
 * 静态 HTML 导出（对应计划 8.8 节）。
 * 复用预览同一套 react-markdown + remark-gfm + remarkWikiLink，
 * 开启 `skipHtml`：不拼接、不执行用户原始 HTML，避免 XSS。
 * 双链在独立 HTML 文件中没有前端路由上下文，渲染为不可点击的 `<span class="wiki-link">`。
 */
const components: Components = {
  a: ({ node, href, children }) => {
    const wikiTitle = node?.properties?.['data-wiki-title']
    if (typeof wikiTitle === 'string') {
      return createElement('span', { className: 'wiki-link', title: wikiTitle }, children)
    }
    const external = /^(?:https?:)?\/\//i.test(href ?? '')
    return createElement('a', { href, ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }, children)
  },
  img: ({ src, alt }) => createElement('img', { src: src ?? '', alt: alt ?? '' }),
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const STYLE = `
body { max-width: 820px; margin: 40px auto; padding: 0 24px; font: 16px/1.7 -apple-system, "Segoe UI", system-ui, sans-serif; color: #24292f; }
h1, h2, h3, h4, h5, h6 { margin: 1.2em 0 0.6em; line-height: 1.3; border-bottom: 0; }
h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
p { margin: 0.6em 0; }
a { color: #0969da; }
code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.9em; }
pre { background: #f6f8fa; padding: 12px 16px; border-radius: 6px; overflow: auto; }
pre code { background: transparent; padding: 0; }
blockquote { margin: 0.6em 0; padding: 0 1em; color: #57606a; border-left: 4px solid #d0d7de; }
table { border-collapse: collapse; margin: 0.8em 0; }
th, td { border: 1px solid #d0d7de; padding: 6px 12px; }
th { background: #f6f8fa; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 1.4em 0; }
ul, ol { padding-left: 1.6em; }
.wiki-link { color: #8250df; }
img { max-width: 100%; }
pre, table, blockquote, li { break-inside: avoid; }
`

export function markdownToHtml(markdown: string, title = ''): string {
  const body = renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkWikiLink], skipHtml: true, components }, markdown),
  )
  const documentTitle = title ? escapeHtml(title) : 'Exported Markdown'
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${documentTitle}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`
}
