import type { DocumentTemplate } from '../index'

export const blogPost: DocumentTemplate = {
  id: 'blog-post',
  name: 'Blog Post',
  description: 'Title, body paragraphs, tags',
  category: 'creative',
  accent: '#ff6d00',
  preview: `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="4" fill="white" stroke="#dadce0"/><rect x="12" y="14" width="80" height="6" rx="1" fill="#ff6d00"/><rect x="12" y="26" width="50" height="2.5" rx="1" fill="#999"/><rect x="12" y="36" width="96" height="20" rx="2" fill="#fff3e0"/><rect x="12" y="62" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="68" width="90" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="74" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="80" width="85" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="90" width="96" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="96" width="90" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="102" width="80" height="2.5" rx="1" fill="#ddd"/><rect x="12" y="116" width="20" height="3" rx="1" fill="#ff6d00" opacity="0.4"/><rect x="36" y="116" width="25" height="3" rx="1" fill="#ff6d00" opacity="0.4"/><rect x="65" y="116" width="20" height="3" rx="1" fill="#ff6d00" opacity="0.4"/></svg>`,
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '[Blog Title]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '24pt' } }, { type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'By [Author] · [Date]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt', color: '#5f6368' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: "[Opening hook — grab the reader's attention with a compelling question or statement.]", marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Main body — develop your ideas with examples and storytelling.]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[Conclusion — wrap up with a call to action or final thought.]', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: ' ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '13pt' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tags: #tag1 #tag2 #tag3', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Helvetica, sans-serif', fontSize: '11pt', color: '#ff6d00' } }] }] },
    ],
  },
}
