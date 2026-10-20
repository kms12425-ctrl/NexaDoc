import type { MarkdownTemplate } from './types'

const markdown = `# Meeting notes

## Meeting details
- Date:
- Attendees:
- Facilitator:

## Agenda
1. Review progress
2. Discuss open questions
3. Agree on next steps

## Discussion
Write your meeting notes here.

## Decisions
- Decision and rationale:

## Action items
| Task | Owner | Due date |
| --- | --- | --- |
| Follow up | | |

- [ ] Share notes with attendees
`

export const meetingNotes: MarkdownTemplate = {
  id: 'md-meeting-notes', name: 'Meeting Notes',
  description: 'Agenda, decisions, and action items', category: 'business',
  accent: '#1a73e8', markdown, preview: '# Meeting notes\n\n## Meeting details\nDate · Attendees\n\n## Agenda\n1. Review progress\n2. Discuss questions\n\n## Action items\n- [ ] Follow up',
}
