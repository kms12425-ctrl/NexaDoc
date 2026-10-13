import type { DocumentTemplate } from '../index'

export const agenda: DocumentTemplate = {
  id: 'agenda',
  name: 'Agenda',
  description: 'Time slots and topic list for meetings',
  category: 'business',
  accent: '#1a73e8',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="50" height="5" rx="1" fill="#1a73e8"/><rect x="12" y="26" width="70" height="3" rx="1" fill="#999"/><line x1="12" y1="36" x2="108" y2="36" stroke="#1a73e8" stroke-width="0.5"/><rect x="12" y="44" width="20" height="3" rx="1" fill="#1a73e8" opacity="0.5"/><rect x="36" y="44" width="60" height="3" rx="1" fill="#333"/><rect x="12" y="54" width="20" height="3" rx="1" fill="#1a73e8" opacity="0.5"/><rect x="36" y="54" width="55" height="3" rx="1" fill="#333"/><rect x="12" y="64" width="20" height="3" rx="1" fill="#1a73e8" opacity="0.5"/><rect x="36" y="64" width="65" height="3" rx="1" fill="#333"/><rect x="12" y="74" width="20" height="3" rx="1" fill="#1a73e8" opacity="0.5"/><rect x="36" y="74" width="50" height="3" rx="1" fill="#333"/><rect x="12" y="84" width="20" height="3" rx="1" fill="#1a73e8" opacity="0.5"/><rect x="36" y="84" width="60" height="3" rx="1" fill="#333"/><rect x="12" y="94" width="20" height="3" rx="1" fill="#1a73e8" opacity="0.5"/><rect x="36" y="94" width="55" height="3" rx="1" fill="#333"/><rect x="12" y="104" width="20" height="3" rx="1" fill="#1a73e8" opacity="0.5"/><rect x="36" y="104" width="65" height="3" rx="1" fill="#333"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Agenda', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '22pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Meeting: [Title]    Date: [Date]    Location: [Venue]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Schedule', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '09:00 – 09:15    Welcome & Introduction', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '09:15 – 10:00    Topic 1: [Description]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '10:00 – 10:15    Break', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '10:15 – 11:00    Topic 2: [Description]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '11:00 – 11:30    Topic 3: [Description]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '11:30 – 12:00    Q&A and Wrap-up', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
    ],
  },
}
