import type { MarkdownTemplate } from './types'

const markdown = `# Daily journal

**Date:**
**Mood:**

## Today
What happened today?

## Highlights
- A memorable moment:
- Something I learned:

## Gratitude
1. Something I am grateful for
2. Someone who helped me

## Reflection
What would I like to do differently?

## Tomorrow
- [ ] One small intention
`

export const journal: MarkdownTemplate = {
  id: 'md-journal', name: 'Daily Journal', description: 'Daily highlights, gratitude, and reflections',
  category: 'personal', accent: '#0f9d58', markdown,
  preview: '# Daily journal\n\nDate · Mood\n\n## Today\nA moment to remember\n\n## Gratitude\n1. Something good\n\n## Tomorrow\n- [ ] One intention',
}
