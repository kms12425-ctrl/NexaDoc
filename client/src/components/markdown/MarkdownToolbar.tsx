import type { MarkdownFormat } from '../../markdown/formatting'

const actions: Array<{ format: MarkdownFormat; label: string; text: string; shortcut?: string }> = [
  { format: 'heading1', label: 'Heading 1', text: 'H1' },
  { format: 'heading2', label: 'Heading 2', text: 'H2' },
  { format: 'heading3', label: 'Heading 3', text: 'H3' },
  { format: 'bold', label: 'Bold', text: 'B', shortcut: 'Ctrl/Cmd+B' },
  { format: 'italic', label: 'Italic', text: 'I', shortcut: 'Ctrl/Cmd+I' },
  { format: 'strike', label: 'Strikethrough', text: 'S̶' },
  { format: 'inlineCode', label: 'Inline code', text: '`code`' },
  { format: 'codeBlock', label: 'Code block', text: '{ }' },
  { format: 'quote', label: 'Blockquote', text: '❯' },
  { format: 'bullet', label: 'Bullet list', text: '• List' },
  { format: 'ordered', label: 'Numbered list', text: '1. List' },
  { format: 'task', label: 'Task list', text: '☐ List' },
  { format: 'link', label: 'Insert link', text: 'Link', shortcut: 'Ctrl/Cmd+K' },
  { format: 'wiki', label: 'Insert wiki link', text: '[[Link]]' },
  { format: 'table', label: 'Insert table', text: 'Table' },
]

export default function MarkdownToolbar({ disabled, onFormat }: { disabled: boolean; onFormat: (format: MarkdownFormat) => void }) {
  return <div className="markdown-format-toolbar" role="group" aria-label="Markdown formatting">
    {actions.map(({ format, label, text, shortcut }) => <button key={format} type="button" aria-label={label} title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => onFormat(format)}>{text}</button>)}
  </div>
}
