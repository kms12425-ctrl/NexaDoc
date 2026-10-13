import type { DocumentTemplate } from '../index'

export const weeklyReport: DocumentTemplate = {
  id: 'weekly-report',
  name: 'Weekly Report',
  description: 'Completed, in progress, next week plan, risks',
  category: 'business',
  accent: '#1a73e8',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="60" height="5" rx="1" fill="#1a73e8"/><rect x="12" y="24" width="96" height="3" rx="1" fill="#eee"/><rect x="12" y="34" width="96" height="3" rx="1" fill="#eee"/><rect x="12" y="40" width="40" height="3" rx="1" fill="#1a73e8" opacity="0.3"/><rect x="12" y="50" width="30" height="4" rx="1" fill="#333"/><rect x="12" y="60" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="65" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="73" width="30" height="4" rx="1" fill="#333"/><rect x="12" y="83" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="88" width="85" height="2" rx="1" fill="#ddd"/><rect x="12" y="96" width="30" height="4" rx="1" fill="#333"/><rect x="12" y="106" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="111" width="70" height="2" rx="1" fill="#ddd"/><rect x="12" y="119" width="30" height="4" rx="1" fill="#333"/><rect x="12" y="129" width="96" height="2" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Weekly Report', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '20pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Week of: [Date Range]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Completed', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'In Progress', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task A (50%)', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Next Week Plan', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'orderedList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Priority 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Risks & Blockers', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'None / Describe any risks…', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
    ],
  },
}
