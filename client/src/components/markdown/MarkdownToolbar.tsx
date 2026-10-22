const ACTIONS: Array<[string, string, string]> = [
  ['H', 'Heading', '# '], ['B', 'Bold', '**'], ['I', 'Italic', '*'], ['S', 'Strikethrough', '~~'], ['`', 'Inline code', '`'],
  ['Code', 'Code block', '```\n'], ['❝', 'Quote', '> '], ['•', 'Bullet list', '- '], ['1.', 'Ordered list', '1. '], ['☑', 'Task list', '- [ ] '], ['↗', 'Link', '[text](url)'], ['[[', 'Wiki link', '[[']], ['▦', 'Table', '| Column | Column |\n| --- | --- |\n| Value | Value |'],
]

export default function MarkdownToolbar({ disabled, onInsert }: { disabled?: boolean; onInsert: (value: string) => void }) {
  return <div className="markdown-toolbar" role="toolbar" aria-label="Markdown formatting">
    {ACTIONS.map(([label, title, value]) => <button key={title} type="button" title={title} aria-label={title} disabled={disabled} onClick={() => onInsert(value)}>{label}</button>)}
  </div>
}
