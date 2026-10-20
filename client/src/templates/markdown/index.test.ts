import { describe, expect, it } from 'vitest'
import { markdownTemplates, markdownTemplateCategories, markdownTemplatesByCategory } from './index'

describe('Markdown templates', () => {
  it('provides seven uniquely identified templates across all five categories', () => {
    expect(markdownTemplates).toHaveLength(7)
    expect(new Set(markdownTemplates.map((template) => template.id)).size).toBe(7)
    expect(markdownTemplateCategories.map(({ key }) => key)).toEqual(['blank', 'business', 'personal', 'education', 'creative'])
    expect(Object.values(markdownTemplatesByCategory).map((templates) => templates.length)).toEqual([1, 2, 2, 1, 1])
  })

  it('keeps the blank template genuinely empty', () => {
    const blank = markdownTemplatesByCategory.blank[0]
    expect(blank.markdown).toBe('')
    expect(blank.preview).toBe('')
  })

  it.each(markdownTemplates.filter((template) => template.category !== 'blank'))('$name supplies portable Markdown source and a text preview', (template) => {
    expect(template.markdown).toMatch(/^# .+\n/)
    expect(template.markdown.endsWith('\n')).toBe(true)
    expect(template.preview.trim()).not.toBe('')
    expect(template.description.trim()).not.toBe('')
    expect(template.accent).toMatch(/^#[0-9a-f]{6}$/i)
    expect(template).not.toHaveProperty('content')
  })

  it('includes useful table, task-list, quotation, link and code examples', () => {
    const source = markdownTemplates.map((template) => template.markdown).join('\n')
    expect(source).toContain('| Task | Owner | Due date |')
    expect(source).toContain('- [ ]')
    expect(source).toContain('> Add a short passage')
    expect(source).toContain('[Resource title](https://example.com)')
    expect(source).toContain('~~~text')
  })
})
