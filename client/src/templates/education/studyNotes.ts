import type { DocumentTemplate } from '../index'

export const studyNotes: DocumentTemplate = {
  id: 'study-notes',
  name: 'Study Notes',
  description: 'Topic, key points, and Q&A',
  category: 'education',
  accent: '#7c3aed',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="60" height="5" rx="1" fill="#7c3aed"/><rect x="12" y="26" width="40" height="2.5" rx="1" fill="#999"/><rect x="12" y="38" width="35" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><circle cx="16" cy="50" r="1.5" fill="#7c3aed"/><rect x="20" y="49" width="60" height="2.5" rx="1" fill="#ccc"/><circle cx="16" cy="58" r="1.5" fill="#7c3aed"/><rect x="20" y="57" width="55" height="2.5" rx="1" fill="#ccc"/><circle cx="16" cy="66" r="1.5" fill="#7c3aed"/><rect x="20" y="65" width="65" height="2.5" rx="1" fill="#ccc"/><rect x="12" y="78" width="35" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="88" width="20" height="2.5" rx="1" fill="#7c3aed" opacity="0.4"/><rect x="36" y="88" width="70" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="96" width="20" height="2.5" rx="1" fill="#7c3aed" opacity="0.4"/><rect x="36" y="96" width="65" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="108" width="35" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="118" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="125" width="90" height="2.5" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '[Topic]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '16pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Subject: __________    Date: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Points', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Point 1', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Point 2', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Point 3', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Q&A', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Q: ', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }, { type: 'bold' }] }, { type: 'text', text: 'Question 1?', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'A: ', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }, { type: 'bold' }] }, { type: 'text', text: 'Answer 1.', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Summary', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Brief summary of what was learned…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
    ],
  },
}
