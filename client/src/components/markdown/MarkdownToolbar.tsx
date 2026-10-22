type ToolbarAction = { label: string; title: string; insert?: string; wrap?: readonly [string, string?] }

const ACTIONS: ToolbarAction[] = [
  { label: 'H', title: 'Heading', insert: '# ' }, { label: 'B', title: 'Bold', wrap: ['**'] }, { label: 'I', title: 'Italic', wrap: ['*'] }, { label: 'S', title: 'Strikethrough', wrap: ['~~'] }, { label: '`', title: 'Inline code', wrap: ['`'] },
  { label: 'Code', title: 'Code block', insert: '```\n' }, { label: '❝', title: 'Quote', insert: '> ' }, { label: '•', title: 'Bullet list', insert: '- ' }, { label: '1.', title: 'Ordered list', insert: '1. ' }, { label: '☑', title: 'Task list', insert: '- [ ] ' }, { label: '↗', title: 'Link', insert: '[text](url)' }, { label: '[[', title: 'Wiki link', insert: '[[' }, { label: '▦', title: 'Table', insert: '| Column | Column |\n| --- | --- |\n| Value | Value |' },
]

export default function MarkdownToolbar({ disabled, onInsert, onWrap }: { disabled?: boolean; onInsert: (value: string) => void; onWrap: (prefix: string, suffix?: string) => void }) {
  return <div className="markdown-toolbar" role="toolbar" aria-label="Markdown formatting">
    {ACTIONS.map((action) => <button key={action.title} type="button" title={action.title} aria-label={action.title} disabled={disabled} onClick={() => action.wrap ? onWrap(...action.wrap) : onInsert(action.insert ?? '')}>{action.label}</button>)}
  </div>
}
