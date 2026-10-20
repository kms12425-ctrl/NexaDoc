export type MarkdownTemplateCategory = 'blank' | 'business' | 'personal' | 'education' | 'creative'

export interface MarkdownTemplate {
  id: string
  name: string
  description: string
  category: MarkdownTemplateCategory
  accent: string
  markdown: string
  preview: string
}
