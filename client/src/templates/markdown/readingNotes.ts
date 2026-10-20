import type { MarkdownTemplate } from './types'

const markdown = `# Reading notes

**Book / article:**
**Author:**
**Date:**

## Main ideas
1. First idea
2. Second idea

## Favorite passage
> Add a short passage and its page number.

## My reflections
What did you learn? What do you disagree with?

## Questions and connections
- Question to explore:
- Related reading:

## Next steps
- [ ] Apply one useful idea
`

export const readingNotes: MarkdownTemplate = {
  id: 'md-reading-notes', name: 'Reading Notes', description: 'Ideas, passages, and personal reflections',
  category: 'personal', accent: '#34a853', markdown,
  preview: '# Reading notes\n\nBook · Author\n\n## Main ideas\n1. A useful idea\n\n> Favorite passage\n\n## My reflections\nWhat did I learn?',
}
