import { blank } from './blank'
import { meetingNotes } from './meetingNotes'
import { weeklyReport } from './weeklyReport'
import { readingNotes } from './readingNotes'
import { journal } from './journal'
import { studyNotes } from './studyNotes'
import { blogDraft } from './blogDraft'
import type { MarkdownTemplate, MarkdownTemplateCategory } from './types'

export type { MarkdownTemplate, MarkdownTemplateCategory } from './types'

export const markdownTemplates: readonly MarkdownTemplate[] = [
  blank, meetingNotes, weeklyReport, readingNotes, journal, studyNotes, blogDraft,
]

export const markdownTemplateCategories: readonly { key: MarkdownTemplateCategory; label: string }[] = [
  { key: 'blank', label: 'Blank' }, { key: 'business', label: 'Business' },
  { key: 'personal', label: 'Personal' }, { key: 'education', label: 'Education' },
  { key: 'creative', label: 'Creative' },
]

const inCategory = (category: MarkdownTemplateCategory) => markdownTemplates.filter((template) => template.category === category)

export const markdownTemplatesByCategory: Record<MarkdownTemplateCategory, readonly MarkdownTemplate[]> = {
  blank: inCategory('blank'), business: inCategory('business'), personal: inCategory('personal'),
  education: inCategory('education'), creative: inCategory('creative'),
}
