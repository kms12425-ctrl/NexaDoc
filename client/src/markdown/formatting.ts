import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import { isolateHistory } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'

export type MarkdownFormat = 'heading1' | 'heading2' | 'heading3' | 'bold' | 'italic' | 'strike' | 'inlineCode' | 'codeBlock' | 'quote' | 'bullet' | 'ordered' | 'task' | 'link' | 'wiki' | 'table'

/** A single transaction keeps a formatting action reversible with one Undo. */
export function formatSelection(state: EditorState, format: MarkdownFormat): TransactionSpec {
  const { from, to } = state.selection.main
  const selected = state.sliceDoc(from, to)
  const replace = (start: number, end: number, insert: string, anchor: number, head = anchor): TransactionSpec => ({
    changes: { from: start, to: end, insert }, selection: EditorSelection.single(anchor, head),
    annotations: isolateHistory.of('full'), userEvent: 'input.format', scrollIntoView: true,
  })
  const wrap = (before: string, after = before, placeholder = 'text') => {
    const italicSelected = before !== '*' || ((selected.match(/^\*+/)?.[0].length ?? 0) % 2 === 1 && (selected.match(/\*+$/)?.[0].length ?? 0) % 2 === 1)
    if (italicSelected && selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
      return replace(from, to, selected.slice(before.length, -after.length), from, to - before.length - after.length)
    }
    const italicSurrounding = before !== '*' || ((state.sliceDoc(0, from).match(/\*+$/)?.[0].length ?? 0) % 2 === 1 && (state.sliceDoc(to).match(/^\*+/)?.[0].length ?? 0) % 2 === 1)
    if (italicSurrounding && from >= before.length && state.sliceDoc(from - before.length, from) === before && state.sliceDoc(to, to + after.length) === after) {
      return replace(from - before.length, to + after.length, selected, from - before.length, to - before.length)
    }
    const text = selected || placeholder
    return replace(from, to, before + text + after, from + before.length, from + before.length + text.length)
  }
  if (format === 'bold') return wrap('**')
  if (format === 'italic') return wrap('*')
  if (format === 'strike') return wrap('~~')
  if (format === 'wiki') return wrap('[[', ']]', 'Document title')
  if (format === 'inlineCode') {
    const longest = Math.max(0, ...Array.from(selected.matchAll(/`+/g), (m) => m[0].length))
    const delimiter = '`'.repeat(longest + 1)
    const padding = selected.startsWith('`') || selected.endsWith('`') ? ' ' : ''
    return wrap(delimiter + padding, padding + delimiter, 'code')
  }
  if (format === 'link') {
    const text = selected || 'link text'
    const prefix = `[${text}](`
    const url = 'https://example.com'
    return replace(from, to, prefix + url + ')', from + prefix.length, from + prefix.length + url.length)
  }
  if (format === 'codeBlock' || format === 'table') {
    const prefix = from > 0 && state.sliceDoc(from - 1, from) !== '\n' ? '\n\n' : ''
    const suffix = to < state.doc.length && state.sliceDoc(to, to + 1) !== '\n' ? '\n\n' : '\n'
    if (format === 'table') {
      const table = '| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n| Cell 3 | Cell 4 |'
      return replace(from, to, prefix + table + suffix, from + prefix.length + 2, from + prefix.length + 10)
    }
    const fence = '`'.repeat(Math.max(3, ...Array.from(selected.matchAll(/`+/g), (m) => m[0].length + 1)))
    const content = selected || 'code'
    const start = from + prefix.length + fence.length + 1
    return replace(from, to, `${prefix}${fence}\n${content}\n${fence}${suffix}`, start, start + content.length)
  }

  const first = state.doc.lineAt(from)
  // A selection ending at the next line's start does not format that next line.
  const last = state.doc.lineAt(to > from && state.doc.lineAt(to).from === to ? to - 1 : to)
  const lines = state.sliceDoc(first.from, last.to).split('\n')
  const marker = format.startsWith('heading') ? '#'.repeat(Number(format.at(-1))) + ' '
    : format === 'quote' ? '> ' : format === 'bullet' ? '- ' : format === 'task' ? '- [ ] ' : ''
  const pattern = format.startsWith('heading') ? /^#{1,6} / : format === 'quote' ? /^> /
    : format === 'ordered' ? /^\d+\. / : format === 'task' ? /^- \[[ xX]\] / : /^[-+*] /
  const removing = format === 'ordered' || format === 'task' ? lines.every((line) => pattern.test(line)) : lines.every((line) => line.startsWith(marker))
  const result = lines.map((line, index) => removing ? line.replace(pattern, '') : (format === 'ordered' ? `${index + 1}. ` : marker) + line.replace(pattern, '')).join('\n')
  if (from === to) {
    const offset = result.split('\n')[0].length - first.length
    return replace(first.from, last.to, result, Math.max(first.from, from + offset))
  }
  return replace(first.from, last.to, result, first.from, first.from + result.length)
}

export function applyMarkdownFormat(view: EditorView, format: MarkdownFormat): boolean {
  if (view.state.readOnly || view.composing) return false
  view.dispatch(formatSelection(view.state, format))
  view.focus()
  return true
}
