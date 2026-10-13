import type { DocumentTemplate } from '../index'

export const storyboard: DocumentTemplate = {
  id: 'storyboard',
  name: 'Storyboard',
  description: 'Scenes with descriptions and notes',
  category: 'creative',
  accent: '#ff6d00',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="60" height="5" rx="1" fill="#ff6d00"/><rect x="12" y="26" width="96" height="20" rx="2" fill="#fff3e0" stroke="#ff6d00" stroke-width="0.5"/><rect x="14" y="28" width="92" height="16" rx="1" fill="none" stroke="#ff6d00" stroke-width="0.3" stroke-dasharray="2 1"/><rect x="12" y="50" width="30" height="2.5" rx="1" fill="#333"/><rect x="12" y="56" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="61" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="70" width="96" height="20" rx="2" fill="#fff3e0" stroke="#ff6d00" stroke-width="0.5"/><rect x="14" y="72" width="92" height="16" rx="1" fill="none" stroke="#ff6d00" stroke-width="0.3" stroke-dasharray="2 1"/><rect x="12" y="94" width="30" height="2.5" rx="1" fill="#333"/><rect x="12" y="100" width="96" height="2" rx="1" fill="#ddd"/><rect x="12" y="105" width="90" height="2" rx="1" fill="#ddd"/><rect x="12" y="114" width="96" height="20" rx="2" fill="#fff3e0" stroke="#ff6d00" stroke-width="0.5"/><rect x="14" y="116" width="92" height="16" rx="1" fill="none" stroke="#ff6d00" stroke-width="0.3" stroke-dasharray="2 1"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Storyboard', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '22pt' } }, { type: 'bold' }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Scene 1', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt', color: '#ff6d00' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Visual: [Describe what the audience sees]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Audio: [Dialogue, narration, sound effects]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Notes: [Camera angle, transition, timing]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Scene 2', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt', color: '#ff6d00' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Visual: [Describe what the audience sees]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Audio: [Dialogue, narration, sound effects]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Notes: [Camera angle, transition, timing]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Scene 3', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt', color: '#ff6d00' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Visual: [Describe what the audience sees]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Audio: [Dialogue, narration, sound effects]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '12pt' } }] }] },
    ],
  },
}
