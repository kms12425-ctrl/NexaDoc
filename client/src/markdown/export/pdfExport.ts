import html2pdf from 'html2pdf.js'
import { markdownToHtml } from './markdownToHtml'
import { sanitizeFilename } from './sanitizeFilename'

/**
 * PDF 导出（对应计划 8.8 节）。
 * Render a detached, normal-flow article inside html2pdf's own staging area.
 * A fixed/offscreen source is cloned with that positioning and can produce a
 * zero-height canvas (a valid but empty PDF). Scope export CSS to the article
 * so it also cannot change the editor's body while the staging area exists.
 */
export async function exportPdf(title: string, markdown: string): Promise<void> {
  const parsed = new DOMParser().parseFromString(markdownToHtml(markdown, title), 'text/html')
  const content = document.createElement('article')
  content.className = 'markdown-pdf-document'
  content.style.cssText = 'position:static;width:100%;max-width:none;margin:0;padding:0;background:#fff;box-sizing:border-box'
  const style = document.createElement('style')
  // The export stylesheet contains ordinary rules only (no nested @rules).
  style.textContent = (parsed.querySelector('style')?.textContent ?? '').replace(/([^{}]+)\{/g, (_rule, selectors: string) => {
    return selectors.split(',').map((selector) => selector.trim() === 'body'
      ? '.markdown-pdf-document'
      : `.markdown-pdf-document ${selector.trim()}`).join(', ') + ' {'
  }) + '\n.markdown-pdf-document p, .markdown-pdf-document h1, .markdown-pdf-document h2, .markdown-pdf-document h3, .markdown-pdf-document h4, .markdown-pdf-document h5, .markdown-pdf-document h6 { break-inside: avoid; }'
  content.appendChild(style)
  content.insertAdjacentHTML('beforeend', parsed.body.innerHTML)
  // Keep a heading and its introductory paragraph together where they fit on
  // one page. Otherwise raster page slicing can cut a heading through its text.
  for (const heading of content.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const paragraph = heading.nextElementSibling
    if (paragraph?.tagName !== 'P') continue
    const group = document.createElement('section')
    group.style.cssText = 'display:flow-root;break-inside:avoid'
    heading.before(group)
    group.append(heading, paragraph)
  }
  const worker = html2pdf().set({
    margin: 10,
    filename: `${sanitizeFilename(title)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, windowWidth: 1024 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(content)
  let overlay: HTMLElement | undefined
  try {
    await worker.toContainer()
    overlay = await worker.get('overlay') as HTMLElement
    await worker.save()
  } finally {
    overlay?.remove()
  }
}
