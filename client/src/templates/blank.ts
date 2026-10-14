import type { DocumentTemplate } from './index'

export const blank: DocumentTemplate = {
  id: 'blank',
  name: 'Blank',
  description: 'Start from scratch',
  category: 'blank',
  accent: '#5f6368',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="20" width="70" height="3" rx="1" fill="#ddd"/><rect x="12" y="30" width="96" height="2" rx="1" fill="#eee"/><rect x="12" y="36" width="90" height="2" rx="1" fill="#eee"/><rect x="12" y="42" width="85" height="2" rx="1" fill="#eee"/></svg>`,
  content: {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  },
}
