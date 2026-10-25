import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './markdownToHtml'

describe('markdownToHtml', () => {
  it('renders headings, lists and code into a complete HTML document', () => {
    const html = markdownToHtml('# Title\n\n- one\n- two\n\n```js\nconst a = 1\n```', 'Doc')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<title>Doc</title>')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<code')
  })

  it('does not execute raw HTML (skipHtml)', () => {
    const html = markdownToHtml('<script>alert(1)</script>\n\n# Safe')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('<h1>Safe</h1>')
  })

  it('renders wiki links as non-navigable spans instead of routes', () => {
    const html = markdownToHtml('See [[Other Doc]] here')
    expect(html).toContain('class="wiki-link"')
    expect(html).not.toContain('/markdown?q=')
  })

  it('escapes the document title to avoid HTML injection', () => {
    const html = markdownToHtml('# x', '<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
  })
})
