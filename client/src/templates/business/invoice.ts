import type { DocumentTemplate } from '../index'

export const invoice: DocumentTemplate = {
  id: 'invoice',
  name: 'Invoice',
  description: 'Seller/buyer info, itemized table, total',
  category: 'business',
  accent: '#1a73e8',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="50" height="5" rx="1" fill="#1a73e8"/><rect x="70" y="14" width="38" height="3" rx="1" fill="#999"/><rect x="12" y="28" width="45" height="2.5" rx="1" fill="#ccc"/><rect x="12" y="33" width="40" height="2.5" rx="1" fill="#ccc"/><rect x="68" y="28" width="40" height="2.5" rx="1" fill="#ccc"/><rect x="68" y="33" width="35" height="2.5" rx="1" fill="#ccc"/><line x1="12" y1="44" x2="108" y2="44" stroke="#1a73e8" stroke-width="1"/><rect x="12" y="50" width="50" height="3" rx="1" fill="#333"/><rect x="70" y="50" width="20" height="3" rx="1" fill="#333"/><rect x="92" y="50" width="16" height="3" rx="1" fill="#333"/><rect x="12" y="58" width="50" height="2.5" rx="1" fill="#ddd"/><rect x="70" y="58" width="20" height="2.5" rx="1" fill="#ddd"/><rect x="92" y="58" width="16" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="65" width="50" height="2.5" rx="1" fill="#ddd"/><rect x="70" y="65" width="20" height="2.5" rx="1" fill="#ddd"/><rect x="92" y="65" width="16" height="2.5" rx="1" fill="#ddd"/><line x1="12" y1="74" x2="108" y2="74" stroke="#ddd" stroke-width="0.5"/><rect x="70" y="80" width="20" height="3" rx="1" fill="#333"/><rect x="92" y="80" width="16" height="3" rx="1" fill="#1a73e8"/><rect x="12" y="100" width="40" height="3" rx="1" fill="#666"/><rect x="12" y="108" width="80" height="2" rx="1" fill="#eee"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'right' }, content: [{ type: 'text', text: 'INVOICE', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '24pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: 'Invoice #: ______  Date: ______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'From', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Your Company Name', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Your Address', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Bill To', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Client Name', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Client Address', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Items', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1 — Qty: __ — Price: $__', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2 — Qty: __ — Price: $__', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] }] },
      ] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2, textAlign: 'right' }, content: [{ type: 'text', text: 'Total: $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }, { type: 'bold' }] }] },
    ],
  },
}
