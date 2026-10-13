import type { DocumentTemplate } from '../index'

export const projectProposal: DocumentTemplate = {
  id: 'project-proposal',
  name: 'Project Proposal',
  description: 'Background, objectives, timeline, and budget',
  category: 'business',
  accent: '#1a73e8',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="80" height="5" rx="1" fill="#1a73e8"/><rect x="12" y="26" width="40" height="3" rx="1" fill="#999"/><rect x="12" y="38" width="30" height="4" rx="1" fill="#333"/><rect x="12" y="48" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="53" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="63" width="30" height="4" rx="1" fill="#333"/><rect x="12" y="73" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="78" width="85" height="2" rx="1" fill="#ddd"/><rect x="12" y="88" width="30" height="4" rx="1" fill="#333"/><rect x="12" y="98" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="103" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="108" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="118" width="60" height="4" rx="1" fill="#333"/><rect x="12" y="128" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="133" width="70" height="2" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Project Proposal', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '22pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Prepared by: [Your Name]    Date: [Date]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Background', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Describe the context and motivation for this project…', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Objectives', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Objective 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Objective 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Timeline', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Phase 1: [Start] – [End]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Phase 2: [Start] – [End]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Phase 3: [Start] – [End]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '4. Budget', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Item 1: $____', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Item 2: $____', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Total: $____', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }, { type: 'bold' }] }] },
    ],
  },
}
