import type { DocumentTemplate } from '../index'

export const journal: DocumentTemplate = {
  id: 'journal',
  name: 'Journal',
  description: 'Date, mood, and free-form reflection',
  category: 'personal',
  accent: '#34a853',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="40" height="4" rx="1" fill="#34a853"/><rect x="12" y="24" width="30" height="2.5" rx="1" fill="#999"/><rect x="12" y="38" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="46" width="90" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="54" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="62" width="85" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="74" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="82" width="90" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="90" width="80" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="102" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="110" width="70" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="122" width="50" height="2.5" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '[Date]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '16pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Mood: ', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '12pt', color: '#5f6368' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Today I…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Grateful for:', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tomorrow I want to…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '12pt' } }] }] },
    ],
  },
}
