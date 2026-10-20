import { act, render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import MarkdownPreview from './MarkdownPreview'

const preview = (markdown: string, targets?: ReadonlyMap<string, string | null>) => render(<MemoryRouter><MarkdownPreview markdown={markdown} targets={targets} /></MemoryRouter>)

describe('MarkdownPreview', () => {
  it('renders headings, emphasis, lists, quotes and fenced code', () => {
    const { container } = preview('# 标题\n\n**粗体** *斜体*\n\n- 项目\n\n> 引用\n\n```js\nconst x = 1\n```')
    expect(screen.getByRole('heading', { name: '标题' })).toBeInTheDocument()
    expect(container.querySelector('strong')).toHaveTextContent('粗体')
    expect(container.querySelector('em')).toHaveTextContent('斜体')
    expect(container.querySelector('blockquote')).toHaveTextContent('引用')
    expect(container.querySelector('pre code')).toHaveTextContent('const x = 1')
  })
  it('renders GFM tables, task lists and strikethrough', () => {
    const { container } = preview('| A | B |\n| --- | --- |\n| 一 | 二 |\n\n- [x] Done\n- [ ] Todo\n\n~~removed~~')
    expect(screen.getByRole('table')).toHaveTextContent('一')
    const tasks = screen.getAllByRole('checkbox')
    expect(tasks[0]).toBeChecked(); expect(tasks[1]).not.toBeChecked()
    expect(tasks.every((task) => task.hasAttribute('disabled'))).toBe(true)
    expect(container.querySelector('del')).toHaveTextContent('removed')
  })
  it('opens external links safely in another tab', () => {
    preview('[Outside](https://example.com)')
    expect(screen.getByRole('link', { name: 'Outside' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'Outside' })).toHaveAttribute('rel', 'noopener noreferrer')
  })
  it('does not execute raw HTML or preserve javascript URLs', () => {
    const { container } = preview('<script>window.evil=1</script>\n\n<img src=x onerror=alert(1)>\n\n[Unsafe](javascript:alert%281%29)')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('Unsafe').getAttribute('href')).not.toMatch(/^javascript:/i)
  })
  it('resolves owned wiki titles and sends missing or duplicate titles to the home filter', () => {
    preview('[[笔记|阅读]] [[Missing]] [[Duplicate]]', new Map([['笔记', 'md-note'], ['Duplicate', null]]))
    expect(screen.getByRole('link', { name: '阅读' })).toHaveAttribute('href', '/markdown/md-note')
    expect(screen.getByRole('link', { name: 'Missing' })).toHaveAttribute('href', '/markdown?q=Missing')
    expect(screen.getByRole('link', { name: 'Duplicate' })).toHaveClass('wiki-link-unresolved')
  })
  it('does not transform code, escaped wiki examples or existing Markdown links', () => {
    preview('`[[inline]]`\n\n```md\n[[fenced]]\n```\n\n\\[[escaped]] [[real]]\n\n[already [[inside]]](https://example.com)')
    expect(screen.queryByRole('link', { name: 'inline' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'fenced' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'escaped' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'real' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
  it('renders empty and malformed source without crashing', async () => {
    const { rerender } = preview('')
    expect(screen.getByText('Start typing to see the preview.')).toBeInTheDocument()
    rerender(<MemoryRouter><MarkdownPreview markdown={'[[open **unclosed `code'} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Markdown preview' })).toHaveTextContent('open'))
  })
  it('debounces preview updates for 80ms and renders the latest source', async () => {
    vi.useFakeTimers()
    try {
      const { rerender } = preview('# Before')
      rerender(<MemoryRouter><MarkdownPreview markdown="# After" /></MemoryRouter>)
      await act(() => vi.advanceTimersByTimeAsync(79))
      expect(screen.getByRole('heading', { name: 'Before' })).toBeInTheDocument()
      await act(() => vi.advanceTimersByTimeAsync(1))
      expect(within(screen.getByRole('region', { name: 'Markdown preview' })).getByRole('heading', { name: 'After' })).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
})
