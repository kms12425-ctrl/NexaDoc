import type { MarkdownTemplate } from './types'

const markdown = `# Weekly report

**Week:**
**Author:**

## Summary
Summarize the week's progress.

## Completed
- [x] First completed task
- [ ] Task in progress

## Metrics
| Metric | Target | Actual |
| --- | --- | --- |
| | | |

## Challenges
- Challenge:
- Support needed:

## Next week
1. First priority
2. Second priority
`

export const weeklyReport: MarkdownTemplate = {
  id: 'md-weekly-report', name: 'Weekly Report', description: 'Progress, metrics, and next-week priorities',
  category: 'business', accent: '#4285f4', markdown,
  preview: '# Weekly report\n\nWeek · Author\n\n## Completed\n- [x] First milestone\n- [ ] Work in progress\n\n## Next week\n1. First priority',
}
