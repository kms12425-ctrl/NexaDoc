import type { DocumentTemplate } from '../index'

export const newsletter: DocumentTemplate = {
  id: 'newsletter',
  name: 'Newsletter',
  description: 'Header, sections, subscribe info',
  category: 'creative',
  accent: '#ff6d00',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="12" width="96" height="8" rx="1" fill="#ff6d00"/><rect x="12" y="24" width="60" height="2.5" rx="1" fill="#fff3e0"/><line x1="12" y1="32" x2="108" y2="32" stroke="#ff6d00" stroke-width="0.5"/><rect x="12" y="38" width="40" height="3" rx="1" fill="#333"/><rect x="12" y="46" width="45" height="2" rx="1" fill="#ddd"/><rect x="12" y="51" width="40" height="2" rx="1" fill="#ddd"/><rect x="12" y="56" width="42" height="2" rx="1" fill="#ddd"/><rect x="60" y="38" width="40" height="3" rx="1" fill="#333"/><rect x="60" y="46" width="45" height="2" rx="1" fill="#ddd"/><rect x="60" y="51" width="40" height="2" rx="1" fill="#ddd"/><rect x="60" y="56" width="42" height="2" rx="1" fill="#ddd"/><rect x="12" y="68" width="40" height="3" rx="1" fill="#333"/><rect x="12" y="76" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="81" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="86" width="85" height="2" rx="1" fill="#ddd"/><line x1="12" y1="96" x2="108" y2="96" stroke="#ddd" stroke-width="0.5"/><rect x="12" y="104" width="60" height="2.5" rx="1" fill="#999"/><rect x="12" y="112" width="80" height="2" rx="1" fill="#eee"/><rect x="12" y="120" width="70" height="2" rx="1" fill="#eee"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: '[Newsletter Name]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '24pt' } }, { type: 'bold' }, { type: 'textStyle', attrs: { color: '#ff6d00' } }] }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Issue #__ · [Date]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Top story or highlight…', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Updates and news…', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section 3', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tips, resources, or upcoming events…', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Subscribe: [Email]    Follow: [Social Links]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt', color: '#5f6368' } }] }] },
    ],
  },
}
