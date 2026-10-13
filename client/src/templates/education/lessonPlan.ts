import type { DocumentTemplate } from '../index'

export const lessonPlan: DocumentTemplate = {
  id: 'lesson-plan',
  name: 'Lesson Plan',
  description: 'Objectives, materials, steps, homework',
  category: 'education',
  accent: '#7c3aed',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="60" height="5" rx="1" fill="#7c3aed"/><rect x="12" y="26" width="50" height="2.5" rx="1" fill="#999"/><rect x="12" y="38" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="48" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="53" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="63" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><circle cx="16" cy="75" r="1.5" fill="#7c3aed"/><rect x="20" y="74" width="60" height="2.5" rx="1" fill="#ccc"/><circle cx="16" cy="83" r="1.5" fill="#7c3aed"/><rect x="20" y="82" width="55" height="2.5" rx="1" fill="#ccc"/><rect x="12" y="93" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="14" y="103" width="6" height="2.5" rx="0.5" fill="#7c3aed" opacity="0.4"/><rect x="22" y="103" width="80" height="2.5" rx="1" fill="#ddd"/><rect x="14" y="111" width="6" height="2.5" rx="0.5" fill="#7c3aed" opacity="0.4"/><rect x="22" y="111" width="75" height="2.5" rx="1" fill="#ddd"/><rect x="14" y="119" width="6" height="2.5" rx="0.5" fill="#7c3aed" opacity="0.4"/><rect x="22" y="119" width="85" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="130" width="30" height="3" rx="1" fill="#7c3aed" opacity="0.6"/><rect x="12" y="140" width="90" height="2" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Lesson Plan', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '16pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Grade: __    Subject: __    Duration: __ min', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Objectives', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'By the end of this lesson, students will be able to…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Materials', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Material 1', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Material 2', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Procedure', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'orderedList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Introduction (__ min): __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Main Activity (__ min): __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Practice (__ min): __________', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Homework', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Assignment description…', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Times New Roman', serif", fontSize: '12pt' } }] }] },
    ],
  },
}
