import type { DocumentTemplate } from '../index'

export const syllabus: DocumentTemplate = {
  id: 'syllabus',
  name: 'Syllabus',
  description: 'Course info, weekly schedule, grading policy',
  category: 'education',
  accent: '#7c3aed',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="60" height="5" rx="1" fill="#7c3aed"/><rect x="12" y="26" width="80" height="2.5" rx="1" fill="#999"/><rect x="12" y="34" width="70" height="2.5" rx="1" fill="#999"/><rect x="12" y="44" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="52" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="57" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="67" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="75" width="20" height="2.5" rx="1" fill="#7c3aed" opacity="0.4"/><rect x="36" y="75" width="65" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="82" width="20" height="2.5" rx="1" fill="#7c3aed" opacity="0.4"/><rect x="36" y="82" width="60" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="89" width="20" height="2.5" rx="1" fill="#7c3aed" opacity="0.4"/><rect x="36" y="89" width="70" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="96" width="20" height="2.5" rx="1" fill="#7c3aed" opacity="0.4"/><rect x="36" y="96" width="55" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="106" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="116" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="121" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="131" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="136" width="70" height="2" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '[Course Name] — Syllabus', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '16pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Instructor: __________    Email: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt', color: '#5f6368' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Office Hours: __________    Location: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Course Description', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Brief overview of the course…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Weekly Schedule', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Week 1: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Week 2: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Week 3: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Week 4: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Grading Policy', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Assignments: __%    Midterm: __%    Final: __%    Participation: __%', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
    ],
  },
}
