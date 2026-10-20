import type { MarkdownTemplate } from './types'

const markdown = `# Blog draft

**Author:**
**Audience:**

## Opening
Start with a question, story, or observation.

## Main point
State the idea you want readers to remember.

### Supporting example
Add evidence or an example.

## Takeaways
- First takeaway
- Second takeaway

## Further reading
- [Resource title](https://example.com)

## Before publishing
- [ ] Check facts and links
- [ ] Edit for clarity
`

export const blogDraft: MarkdownTemplate = {
  id: 'md-blog-draft', name: 'Blog Draft', description: 'An opening, supporting ideas, and a publishing checklist',
  category: 'creative', accent: '#e8710a', markdown,
  preview: '# Blog draft\n\nAuthor · Audience\n\n## Opening\nA story worth sharing\n\n## Main point\nAn idea to remember\n\n## Takeaways\n- First takeaway',
}
