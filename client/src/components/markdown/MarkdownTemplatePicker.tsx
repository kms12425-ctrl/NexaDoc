import { useEffect, useRef, useState } from 'react'
import { markdownTemplates, markdownTemplateCategories } from '../../templates/markdown'
import type { MarkdownTemplate, MarkdownTemplateCategory } from '../../templates/markdown'
import MarkdownTemplatePreview from './MarkdownTemplatePreview'

export default function MarkdownTemplatePicker({ onSelect, onClose }: {
  onSelect: (template: MarkdownTemplate) => void
  onClose: () => void
}) {
  const [category, setCategory] = useState<MarkdownTemplateCategory | 'all'>('all')
  const modalRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const templates = category === 'all' ? markdownTemplates : markdownTemplates.filter((template) => template.category === category)

  useEffect(() => {
    const previousFocus = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  return (
    <div className="modal-overlay template-picker-overlay" role="dialog" aria-modal="true" aria-label="Choose a Markdown template" onClick={onClose} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'Tab') {
        const controls = Array.from(modalRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }}>
      <div ref={modalRef} className="modal template-picker markdown-template-picker" onClick={(event) => event.stopPropagation()}>
        <div className="template-picker-header">
          <h2 className="modal-title">Choose a Markdown template</h2>
          <button ref={closeRef} type="button" className="template-picker-close" aria-label="Close template picker" onClick={onClose}>×</button>
        </div>
        <div className="template-categories" role="group" aria-label="Picker categories">
          {[{ key: 'all' as const, label: 'All' }, ...markdownTemplateCategories].map(({ key, label }) => (
            <button key={key} type="button" className={`template-cat-tab ${category === key ? 'active' : ''}`} aria-pressed={category === key} onClick={() => setCategory(key)}>{label}</button>
          ))}
        </div>
        <div className="template-grid">
          {templates.map((template) => (
            <button key={template.id} type="button" className="template-card" title={template.description} onClick={() => onSelect(template)}>
              <div className="template-card-preview" style={{ borderTop: `3px solid ${template.accent}` }}><MarkdownTemplatePreview template={template} /></div>
              <div className="template-card-info"><span className="template-card-name">{template.name}</span><span className="template-card-desc">{template.description}</span></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
