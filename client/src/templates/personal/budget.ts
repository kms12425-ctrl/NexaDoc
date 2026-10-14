import type { DocumentTemplate } from '../index'

export const budget: DocumentTemplate = {
  id: 'budget',
  name: 'Personal Budget',
  description: 'Income, expense categories, and totals',
  category: 'personal',
  accent: '#34a853',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="70" height="5" rx="1" fill="#34a853"/><rect x="12" y="26" width="30" height="3" rx="1" fill="#333"/><rect x="80" y="26" width="28" height="3" rx="1" fill="#333"/><rect x="12" y="34" width="60" height="2.5" rx="1" fill="#ddd"/><rect x="80" y="34" width="28" height="2.5" rx="1" fill="#ddd"/><line x1="12" y1="42" x2="108" y2="42" stroke="#ddd" stroke-width="0.5"/><rect x="12" y="48" width="30" height="3" rx="1" fill="#333"/><rect x="80" y="48" width="28" height="3" rx="1" fill="#333"/><rect x="12" y="56" width="60" height="2.5" rx="1" fill="#ddd"/><rect x="80" y="56" width="28" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="63" width="55" height="2.5" rx="1" fill="#ddd"/><rect x="80" y="63" width="28" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="70" width="65" height="2.5" rx="1" fill="#ddd"/><rect x="80" y="70" width="28" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="77" width="50" height="2.5" rx="1" fill="#ddd"/><rect x="80" y="77" width="28" height="2.5" rx="1" fill="#ddd"/><line x1="12" y1="86" x2="108" y2="86" stroke="#ddd" stroke-width="0.5"/><rect x="12" y="92" width="40" height="4" rx="1" fill="#34a853"/><rect x="80" y="92" width="28" height="4" rx="1" fill="#34a853"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Personal Budget', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '20pt' } }, { type: 'bold' }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Income', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Salary:          $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Other:           $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Total Income:    $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Expenses', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Rent/Housing:    $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Food:            $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Transport:       $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Entertainment:   $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Other:           $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Total Expenses:  $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '11pt' } }] }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Savings: $______', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial, sans-serif', fontSize: '14pt', color: '#34a853' } }, { type: 'bold' }] }] },
    ],
  },
}
