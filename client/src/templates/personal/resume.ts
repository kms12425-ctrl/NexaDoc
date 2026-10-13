import type { DocumentTemplate } from '../index'

export const resume: DocumentTemplate = {
  id: 'resume',
  name: 'Resume',
  description: 'Contact, education, work experience, skills',
  category: 'personal',
  accent: '#34a853',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="60" height="5" rx="1" fill="#34a853"/><rect x="12" y="24" width="80" height="2.5" rx="1" fill="#999"/><rect x="12" y="30" width="70" height="2.5" rx="1" fill="#999"/><line x1="12" y1="40" x2="108" y2="40" stroke="#34a853" stroke-width="0.5"/><rect x="12" y="46" width="35" height="3" rx="1" fill="#34a853" opacity="0.6"/><rect x="12" y="54" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="59" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="68" width="35" height="3" rx="1" fill="#34a853" opacity="0.6"/><rect x="12" y="76" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="81" width="85" height="2" rx="1" fill="#ddd"/><rect x="12" y="90" width="35" height="3" rx="1" fill="#34a853" opacity="0.6"/><rect x="12" y="98" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="103" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="112" width="35" height="3" rx="1" fill="#34a853" opacity="0.6"/><rect x="12" y="120" width="40" height="2" rx="1" fill="#ddd"/><rect x="58" y="120" width="40" height="2" rx="1" fill="#ddd"/><rect x="12" y="126" width="35" height="2" rx="1" fill="#ddd"/><rect x="58" y="126" width="35" height="2" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '[Your Name]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '22pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Email] | [Phone] | [LinkedIn] | [Location]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Education', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt', color: '#34a853' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Degree], [University] — [Year]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Relevant coursework or achievements…', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Work Experience', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt', color: '#34a853' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Job Title], [Company] — [Start] – [End]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Achievement 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Achievement 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Skills', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt', color: '#34a853' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Skill 1, Skill 2, Skill 3', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] }] },
      ] },
    ],
  },
}
