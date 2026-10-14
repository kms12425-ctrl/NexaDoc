import type { DocumentTemplate } from '../index'

export const travelPlan: DocumentTemplate = {
  id: 'travel-plan',
  name: 'Travel Plan',
  description: 'Itinerary, accommodation, budget, packing list',
  category: 'personal',
  accent: '#34a853',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="50" height="5" rx="1" fill="#34a853"/><rect x="12" y="24" width="70" height="2.5" rx="1" fill="#999"/><rect x="12" y="36" width="30" height="3" rx="1" fill="#333"/><rect x="12" y="44" width="20" height="2.5" rx="1" fill="#34a853" opacity="0.5"/><rect x="36" y="44" width="60" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="51" width="20" height="2.5" rx="1" fill="#34a853" opacity="0.5"/><rect x="36" y="51" width="55" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="58" width="20" height="2.5" rx="1" fill="#34a853" opacity="0.5"/><rect x="36" y="58" width="65" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="70" width="35" height="3" rx="1" fill="#333"/><rect x="12" y="78" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="85" width="90" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="96" width="30" height="3" rx="1" fill="#333"/><rect x="12" y="106" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="113" width="85" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="124" width="30" height="3" rx="1" fill="#333"/><circle cx="16" cy="134" r="1.5" fill="#34a853"/><rect x="20" y="133" width="50" height="2.5" rx="1" fill="#ccc"/><circle cx="16" cy="141" r="1.5" fill="#34a853"/><rect x="20" y="140" width="45" height="2.5" rx="1" fill="#ccc"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Travel Plan', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '20pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Destination: __________    Dates: __ to __', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Itinerary', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Day 1: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Day 2: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Day 3: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Accommodation', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Hotel: __________    Address: __________    Confirmation: __________', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Budget', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Flights: $____    Hotel: $____    Food: $____    Activities: $____    Total: $____', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Packing List', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '14pt' } }] }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Passport / ID', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Charger / Adapter', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt' } }] }] }] },
      ] },
    ],
  },
}
