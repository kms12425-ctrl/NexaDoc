import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportPdf } from './pdfExport'

const { worker } = vi.hoisted(() => ({ worker: { set: vi.fn(), from: vi.fn(), toContainer: vi.fn(), get: vi.fn(), save: vi.fn() } }))
vi.mock('html2pdf.js', () => ({ default: () => worker }))
let overlay: HTMLDivElement
beforeEach(() => {
  vi.clearAllMocks()
  overlay = document.createElement('div')
  worker.set.mockReturnValue(worker)
  worker.from.mockReturnValue(worker)
  worker.toContainer.mockImplementation(async () => { document.body.appendChild(overlay) })
  worker.get.mockResolvedValue(overlay)
  worker.save.mockResolvedValue(undefined)
})

describe('PDF export rendering source', () => {
  it('uses normal-flow sanitized content and scoped styles instead of a fixed/offscreen full HTML document', async () => {
    await exportPdf('导出/报告', '# 中文标题\n\n正文 END\n\n<script>alert(1)</script>')
    const source = worker.from.mock.calls[0][0] as HTMLElement
    expect(source.tagName).toBe('ARTICLE')
    expect(source.style.position).toBe('static')
    expect(source.style.left).toBe('')
    expect(source.style.width).toBe('100%')
    expect(document.body.contains(source)).toBe(false)
    expect(source.querySelector('h1')).toHaveTextContent('中文标题')
    expect(source).toHaveTextContent('正文 END')
    expect(source.querySelector('html,head,body,script')).toBeNull()
    const css = source.querySelector('style')!.textContent!
    expect(css).not.toMatch(/(^|})\s*body\s*\{/)
    expect(css).toContain('.markdown-pdf-document pre, .markdown-pdf-document table')
    expect(css).toContain('break-inside: avoid')
    expect(source.querySelector('h1')!.parentElement!.style.breakInside).toBe('avoid')
    expect(source.querySelector('h1')!.nextElementSibling).toHaveTextContent('正文 END')
    expect(worker.set).toHaveBeenCalledWith(expect.objectContaining({ filename: '导出报告.pdf', jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }))
    expect(worker.save).toHaveBeenCalledOnce()
    expect(overlay.isConnected).toBe(false)
  })
  it('cleans up the staging overlay when PDF rendering fails', async () => {
    worker.save.mockRejectedValueOnce(new Error('Canvas failed'))
    await expect(exportPdf('Doc', '# Content')).rejects.toThrow('Canvas failed')
    expect(overlay.isConnected).toBe(false)
  })
})
