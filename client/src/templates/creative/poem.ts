import type { DocumentTemplate } from '../index'

export const poem: DocumentTemplate = {
  id: 'poem',
  name: 'Poem',
  description: 'Title and stanzas',
  category: 'creative',
  accent: '#e91e63',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="35" y="18" width="50" height="5" rx="1" fill="#e91e63"/><rect x="30" y="34" width="40" height="2.5" rx="1" fill="#ddd"/><rect x="34" y="40" width="50" height="2.5" rx="1" fill="#ddd"/><rect x="32" y="46" width="45" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="52" width="40" height="2.5" rx="1" fill="#ddd"/><rect x="30" y="66" width="45" height="2.5" rx="1" fill="#ddd"/><rect x="34" y="72" width="50" height="2.5" rx="1" fill="#ddd"/><rect x="32" y="78" width="45" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="84" width="40" height="2.5" rx="1" fill="#ddd"/><rect x="30" y="98" width="40" height="2.5" rx="1" fill="#ddd"/><rect x="34" y="104" width="50" height="2.5" rx="1" fill="#ddd"/><rect x="32" y="110" width="45" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="116" width="40" height="2.5" rx="1" fill="#ddd"/><rect x="30" y="130" width="50" height="2.5" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: '[Poem Title]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '24pt' } }, { type: 'bold' }, { type: 'textStyle', attrs: { color: '#e91e63' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'by [Author]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Line 1 of stanza 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Line 2 of stanza 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Line 3 of stanza 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Line 4 of stanza 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Line 1 of stanza 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Line 2 of stanza 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Line 3 of stanza 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Line 4 of stanza 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
    ],
  },
}
