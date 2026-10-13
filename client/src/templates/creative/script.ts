import type { DocumentTemplate } from '../index'

export const script: DocumentTemplate = {
  id: 'script',
  name: 'Script',
  description: 'Scene headings, characters, dialogue',
  category: 'creative',
  accent: '#ff6d00',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="80" height="4" rx="1" fill="#ff6d00"/><rect x="12" y="26" width="60" height="2.5" rx="1" fill="#333"/><rect x="12" y="34" width="30" height="3" rx="1" fill="#ff6d00" opacity="0.6"/><rect x="12" y="42" width="20" height="2.5" rx="1" fill="#666"/><rect x="36" y="42" width="70" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="48" width="65" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="54" width="60" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="64" width="20" height="2.5" rx="1" fill="#666"/><rect x="36" y="64" width="70" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="70" width="65" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="82" width="30" height="3" rx="1" fill="#ff6d00" opacity="0.6"/><rect x="12" y="90" width="20" height="2.5" rx="1" fill="#666"/><rect x="36" y="90" width="70" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="96" width="65" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="102" width="60" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="112" width="20" height="2.5" rx="1" fill="#666"/><rect x="36" y="112" width="70" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="118" width="65" height="2.5" rx="1" fill="#ddd"/><rect x="36" y="124" width="60" height="2.5" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '[Script Title]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '14pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Written by [Author]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'SCENE 1 — [INT/EXT. LOCATION — DAY/NIGHT]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '12pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Stage directions: describe the setting and action]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'CHARACTER NAME', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Dialogue line 1.', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Dialogue line 2.', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'OTHER CHARACTER', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Response dialogue.', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'SCENE 2 — [INT/EXT. LOCATION — DAY/NIGHT]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '12pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Stage directions]', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'CHARACTER NAME', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Dialogue line.', marks: [{ type: 'textStyle', attrs: { fontFamily: "'Courier New', monospace", fontSize: '11pt' } }] }] },
    ],
  },
}
