import { useState } from 'react'
import { allTemplates, templatesByCategory } from '../templates'
import type { DocumentTemplate, TemplateCategory } from '../templates'
import TemplateThumbnail from './TemplateThumbnail'

interface TemplatePickerProps {
  onSelect: (template: DocumentTemplate) => void
  onClose: () => void
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'blank', label: 'Blank' },
  { key: 'business', label: 'Business' },
  { key: 'personal', label: 'Personal' },
  { key: 'education', label: 'Education' },
  { key: 'creative', label: 'Creative' },
]

export default function TemplatePicker({ onSelect, onClose }: TemplatePickerProps)
{
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const templates = activeCategory === 'all'
    ? allTemplates
    : (templatesByCategory[activeCategory] || [])

  return (
    <div
      className="modal-overlay template-picker-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a template"
    >
      <div
        className="modal template-picker"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="template-picker-header">
          <h2 className="modal-title">Choose a template</h2>
          <button className="template-picker-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Category tabs */}
        <div className="template-categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`template-cat-tab ${activeCategory === cat.key ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="template-grid">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              className="template-card"
              onClick={() => onSelect(tpl)}
              title={tpl.description}
            >
              <div
                className="template-card-preview"
                style={{ borderTop: `3px solid ${tpl.accent}` }}
              >
                <TemplateThumbnail templateContent={tpl.content} />
              </div>
              <div className="template-card-info">
                <span className="template-card-name">{tpl.name}</span>
                <span className="template-card-desc">{tpl.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
