import type { MarkdownTemplate } from './types'

const markdown = `# Study notes

**Course / topic:**
**Date:**

## Learning goals
- [ ] Understand the key concepts
- [ ] Complete a practice exercise

## Key concepts
### First concept
Definition, explanation, and examples.

## Worked example
~~~text
Write a small example here.
~~~

## Questions
- What still needs clarification?

## Review
1. Explain the topic in your own words.
2. List the most important takeaways.
`

export const studyNotes: MarkdownTemplate = {
  id: 'md-study-notes', name: 'Study Notes', description: 'Learning goals, key concepts, and review questions',
  category: 'education', accent: '#7c3aed', markdown,
  preview: '# Study notes\n\nCourse · Topic\n\n## Learning goals\n- [ ] Key concepts\n\n## Worked example\nAn example to revisit\n\n## Review\nWhat did I learn?',
}
