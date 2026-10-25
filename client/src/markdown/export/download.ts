import { saveAs } from 'file-saver'
import { sanitizeFilename } from './sanitizeFilename'

/**
 * 统一封装 file-saver 的下载，保证所有导出走同一套文件名清洗逻辑。
 */
export function downloadMarkdown(title: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  saveAs(blob, `${sanitizeFilename(title)}.md`)
}

export function downloadHtml(title: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  saveAs(blob, `${sanitizeFilename(title)}.html`)
}

export function downloadDocx(title: string, blob: Blob): void {
  saveAs(blob, `${sanitizeFilename(title)}.docx`)
}
