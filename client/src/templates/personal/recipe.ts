import type { DocumentTemplate } from '../index'

export const recipe: DocumentTemplate = {
  id: 'recipe',
  name: 'Recipe',
  description: 'Ingredients, steps, and notes',
  category: 'personal',
  accent: '#34a853',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="60" height="5" rx="1" fill="#34a853"/><rect x="12" y="24" width="50" height="2.5" rx="1" fill="#999"/><rect x="12" y="36" width="30" height="3" rx="1" fill="#333"/><circle cx="16" cy="48" r="1.5" fill="#34a853"/><rect x="20" y="47" width="60" height="2.5" rx="1" fill="#ccc"/><circle cx="16" cy="56" r="1.5" fill="#34a853"/><rect x="20" y="55" width="55" height="2.5" rx="1" fill="#ccc"/><circle cx="16" cy="64" r="1.5" fill="#34a853"/><rect x="20" y="63" width="65" height="2.5" rx="1" fill="#ccc"/><circle cx="16" cy="72" r="1.5" fill="#34a853"/><rect x="20" y="71" width="50" height="2.5" rx="1" fill="#ccc"/><rect x="12" y="84" width="30" height="3" rx="1" fill="#333"/><rect x="14" y="94" width="6" height="2.5" rx="0.5" fill="#34a853" opacity="0.5"/><rect x="22" y="94" width="80" height="2.5" rx="1" fill="#ddd"/><rect x="14" y="102" width="6" height="2.5" rx="0.5" fill="#34a853" opacity="0.5"/><rect x="22" y="102" width="75" height="2.5" rx="1" fill="#ddd"/><rect x="14" y="110" width="6" height="2.5" rx="0.5" fill="#34a853" opacity="0.5"/><rect x="22" y="110" width="85" height="2.5" rx="1" fill="#ddd"/><rect x="14" y="118" width="6" height="2.5" rx="0.5" fill="#34a853" opacity="0.5"/><rect x="22" y="118" width="70" height="2.5" rx="1" fill="#ddd"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '[Recipe Name]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '22pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Prep: __ min    Cook: __ min    Serves: __', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Ingredients', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1 cup __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '2 tbsp __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1 tsp __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pinch of __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Instructions', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] }] },
      { type: 'orderedList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step 1: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step 2: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step 3: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step 4: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Notes', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] },
    ],
  },
}
