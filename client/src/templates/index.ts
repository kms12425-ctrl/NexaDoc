export type TemplateCategory = 'business' | 'personal' | 'education' | 'creative'

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory | 'blank'
  accent: string       // 卡片主题色 (hex)
  preview: string      // 内联 SVG 字符串
  content: object      // TipTap JSON (ProseMirror node)
}

import { blank } from './blank'
import { meetingNotes } from './business/meetingNotes'
import { projectProposal } from './business/projectProposal'
import { weeklyReport } from './business/weeklyReport'
import { invoice } from './business/invoice'
import { agenda } from './business/agenda'
import { businessLetter } from './business/businessLetter'
import { resume } from './personal/resume'
import { journal } from './personal/journal'
import { budget } from './personal/budget'
import { recipe } from './personal/recipe'
import { travelPlan } from './personal/travelPlan'
import { essay } from './education/essay'
import { studyNotes } from './education/studyNotes'
import { lessonPlan } from './education/lessonPlan'
import { researchPaper } from './education/researchPaper'
import { syllabus } from './education/syllabus'
import { blogPost } from './creative/blogPost'
import { newsletter } from './creative/newsletter'
import { storyboard } from './creative/storyboard'
import { poem } from './creative/poem'
import { script } from './creative/script'

export const allTemplates: DocumentTemplate[] = [
  blank,
  meetingNotes, projectProposal, weeklyReport, invoice, agenda, businessLetter,
  resume, journal, budget, recipe, travelPlan,
  essay, studyNotes, lessonPlan, researchPaper, syllabus,
  blogPost, newsletter, storyboard, poem, script,
]

export const templatesByCategory: Record<string, DocumentTemplate[]> = {
  all: allTemplates,
  blank: [blank],
  business: [meetingNotes, projectProposal, weeklyReport, invoice, agenda, businessLetter],
  personal: [resume, journal, budget, recipe, travelPlan],
  education: [essay, studyNotes, lessonPlan, researchPaper, syllabus],
  creative: [blogPost, newsletter, storyboard, poem, script],
}
