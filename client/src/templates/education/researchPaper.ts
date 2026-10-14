import type { DocumentTemplate } from '../index'

export const researchPaper: DocumentTemplate = {
  id: 'research-paper',
  name: 'Research Paper',
  description: 'Abstract, method, results, discussion',
  category: 'education',
  accent: '#7c3aed',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="25" y="14" width="70" height="5" rx="1" fill="#7c3aed"/><rect x="35" y="24" width="50" height="2.5" rx="1" fill="#999"/><line x1="12" y1="32" x2="108" y2="32" stroke="#7c3aed" stroke-width="0.5"/><rect x="12" y="38" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.4"/><rect x="12" y="46" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="51" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="56" width="85" height="2" rx="1" fill="#ddd"/><rect x="12" y="66" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="76" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="81" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="91" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="101" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="106" width="85" height="2" rx="1" fill="#ddd"/><rect x="12" y="116" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="126" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="131" width="70" height="2" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: '[Research Title]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '16pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: '[Author] — [Institution] — [Date]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Abstract', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Brief summary of the research question, method, and key findings…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Method', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Describe participants, materials, and procedure…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Results', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Present data and statistical analysis…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Discussion', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Interpret findings, limitations, and implications…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
    ],
  },
}
