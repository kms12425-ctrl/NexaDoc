import type { DocumentTemplate } from '../index'

export const businessLetter: DocumentTemplate = {
  id: 'business-letter',
  name: 'Business Letter',
  description: 'Formal letter with recipient, body, and signature',
  category: 'business',
  accent: '#1a73e8',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="70" height="4" rx="1" fill="#333"/><rect x="12" y="22" width="60" height="4" rx="1" fill="#333"/><rect x="12" y="30" width="65" height="4" rx="1" fill="#333"/><rect x="12" y="44" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="50" width="90" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="56" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="62" width="85" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="72" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="78" width="90" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="84" width="80" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="100" width="50" height="3" rx="1" fill="#333"/><rect x="12" y="108" width="40" height="2.5" rx="1" fill="#ccc"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '[Your Name]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Your Address]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Date]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Dear [Recipient Name],', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'I am writing to [state the purpose of your letter]. [Explain the details in a clear and concise manner. Include any relevant information that supports your purpose.]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Add any additional information or requests. Keep paragraphs focused and brief.]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Thank you for your time and consideration. I look forward to hearing from you.', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Sincerely,', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Your Name]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '12pt' } }] }] },
    ],
  },
}
