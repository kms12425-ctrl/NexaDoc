import type { DocumentTemplate } from '../index'

export const meetingNotes: DocumentTemplate = {
  id: 'meeting-notes',
  name: 'Meeting Notes',
  description: 'Agenda, attendees, decisions, and action items',
  category: 'business',
  accent: '#1a73e8',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="30" y="14" width="60" height="5" rx="1" fill="#1a73e8"/><rect x="35" y="24" width="50" height="3" rx="1" fill="#999"/><rect x="12" y="36" width="40" height="4" rx="1" fill="#333"/><circle cx="16" cy="48" r="1.5" fill="#666"/><rect x="20" y="47" width="50" height="2.5" rx="1" fill="#ccc"/><circle cx="16" cy="56" r="1.5" fill="#666"/><rect x="20" y="55" width="45" height="2.5" rx="1" fill="#ccc"/><rect x="12" y="68" width="35" height="4" rx="1" fill="#333"/><rect x="12" y="78" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="84" width="90" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="90" width="85" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="100" width="30" height="4" rx="1" fill="#333"/><rect x="12" y="110" width="80" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="116" width="70" height="2.5" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Meeting Notes', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '24pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Date: ____________________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Attendees', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name 3', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Agenda', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] }] },
      { type: 'orderedList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Topic 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Topic 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Decisions', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Action Items', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[ ] Task — Owner — Due date', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
      ] },
    ],
  },
}
