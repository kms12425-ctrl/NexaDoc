import type { MarkdownTemplate } from '../../templates/markdown'

/** Plain React text keeps template thumbnails small and does not execute HTML. */
export default function MarkdownTemplatePreview({ template }: { template: MarkdownTemplate }) {
  return (
    <div className="markdown-template-preview" aria-hidden="true">
      {template.preview ? template.preview.split('\n').slice(0, 13).map((line, index) => (
        <div key={index} className={line.startsWith('# ') ? 'md-preview-title' : line.startsWith('## ') ? 'md-preview-heading' : 'md-preview-line'}>
          {line.replace(/^#{1,6}\s+/, '') || '\u00a0'}
        </div>
      )) : <span className="markdown-blank-icon">M↓</span>}
    </div>
  )
}
