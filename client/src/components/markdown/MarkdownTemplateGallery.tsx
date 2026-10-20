import { useState } from 'react'
import { markdownTemplateCategories, markdownTemplatesByCategory } from '../../templates/markdown'
import type { MarkdownTemplate, MarkdownTemplateCategory } from '../../templates/markdown'
import MarkdownTemplatePreview from './MarkdownTemplatePreview'

export default function MarkdownTemplateGallery({ onSelect }: { onSelect: (template: MarkdownTemplate) => void }) {
  const [category, setCategory] = useState<MarkdownTemplateCategory>('blank')

  return (
    <section className="start-section" aria-label="Markdown templates">
      <h2 className="section-label">Start a new document</h2>
      <div className="template-categories start-categories" role="group" aria-label="Template categories">
        {markdownTemplateCategories.map(({ key, label }) => (
          <button key={key} type="button" className={`template-cat-tab ${category === key ? 'active' : ''}`} aria-pressed={category === key} onClick={() => setCategory(key)}>{label}</button>
        ))}
      </div>
      <div className="template-row-scroll">
        {markdownTemplatesByCategory[category].map((template) => (
          <button key={template.id} type="button" className="start-card template-start-card" title={template.description} onClick={() => onSelect(template)}>
            <div className="start-card-preview template-thumb" style={{ borderTop: `3px solid ${template.accent}` }}>
              <MarkdownTemplatePreview template={template} />
            </div>
            <span>{template.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
