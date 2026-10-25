import html2pdf from 'html2pdf.js'
import { markdownToHtml } from './markdownToHtml'
import { sanitizeFilename } from './sanitizeFilename'

/**
 * PDF 导出（对应计划 8.8 节）。
 * 复用 markdownToHtml 生成带样式的完整 HTML，再交给 html2pdf.js 离屏渲染，
 * 保证在 Source 布局（预览被 CSS 隐藏）下也能导出完整内容；
 * 分页靠 CSS `break-inside: avoid`。
 */
export async function exportPdf(title: string, markdown: string): Promise<void> {
  const html = markdownToHtml(markdown, title)
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '820px'
  container.style.background = '#ffffff'
  container.innerHTML = html
  document.body.appendChild(container)
  try {
    await html2pdf()
      .set({
        margin: 10,
        filename: `${sanitizeFilename(title)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
      })
      .from(container)
      .save()
  } finally {
    container.remove()
  }
}
