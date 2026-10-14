import type { DocumentTemplate } from '../index'

export const essay: DocumentTemplate = {
  id: 'essay',
  name: 'Essay',
  description: 'Title, introduction, body, conclusion, references',
  category: 'education',
  accent: '#7c3aed',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="30" y="16" width="60" height="5" rx="1" fill="#7c3aed"/><rect x="40" y="26" width="40" height="2.5" rx="1" fill="#999"/><rect x="12" y="38" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="48" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="53" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="58" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="63" width="85" height="2" rx="1" fill="#ddd"/><rect x="12" y="73" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="83" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="88" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="93" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="98" width="80" height="2" rx="1" fill="#ddd"/><rect x="12" y="108" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="118" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="123" width="70" height="2" rx="1" fill="#ddd"/><rect x="12" y="133" width="40" height="3" rx="1" fill="#7c3aed" opacity="0.6"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: '[Essay Title]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '16pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: '[Author Name]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Introduction', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Introduce the topic and present your thesis statement…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Body', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'First argument with supporting evidence…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Second argument with analysis…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Third argument with counterpoints…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Summarize key points and restate thesis…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'References', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Author]. ([Year]). [Title]. [Publisher].', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '11pt' } }] }] },
    ],
  },
}
