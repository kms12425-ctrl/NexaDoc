import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { history, undo } from '@codemirror/commands'
import { formatSelection, type MarkdownFormat } from './formatting'

function format(doc: string, action: MarkdownFormat, from = 0, to = doc.length) {
  const state = EditorState.create({ doc, selection: { anchor: from, head: to } })
  return state.update(formatSelection(state, action)).state
}

describe('Markdown formatting transactions', () => {
  it.each<[MarkdownFormat, string]>([
    ['heading1', '# 中文'], ['heading2', '## 中文'], ['heading3', '### 中文'],
    ['bold', '**中文**'], ['italic', '*中文*'], ['strike', '~~中文~~'],
    ['inlineCode', '`中文`'], ['quote', '> 中文'], ['bullet', '- 中文'],
    ['ordered', '1. 中文'], ['task', '- [ ] 中文'], ['wiki', '[[中文]]'],
    ['link', '[中文](https://example.com)'], ['codeBlock', '```\n中文\n```\n'],
  ])('formats selected Chinese source with %s', (action, expected) => {
    expect(format('中文', action).doc.toString()).toBe(expected)
  })
  it('inserts placeholders at the cursor and selects only the editable text', () => {
    const state = format('before after', 'bold', 7, 7)
    expect(state.doc.toString()).toBe('before **text**after')
    expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('text')
  })
  it('toggles surrounding markers without dropping the selection', () => {
    const state = format('**中文**', 'bold', 2, 4)
    expect(state.doc.toString()).toBe('中文')
    expect(state.selection.main.to).toBe(2)
    expect(format('**中文**', 'bold').doc.toString()).toBe('中文')
  })
  it('adds italic to bold text instead of accidentally removing its bold markers', () => {
    expect(format('**text**', 'italic').doc.toString()).toBe('***text***')
    expect(format('**text**', 'italic', 2, 6).doc.toString()).toBe('***text***')
    expect(format('***text***', 'italic').doc.toString()).toBe('**text**')
  })
  it('applies block formatting to whole selected lines and excludes the next line boundary', () => {
    expect(format('one\ntwo\nthree', 'ordered', 1, 8).doc.toString()).toBe('1. one\n2. two\nthree')
    expect(format('- [x] one\n- [ ] two', 'task').doc.toString()).toBe('one\ntwo')
    const cursor = format('text', 'heading2', 2, 2)
    expect(cursor.selection.main.empty).toBe(true)
    expect(cursor.selection.main.head).toBe(5)
  })
  it('uses a safe delimiter when formatting code containing backticks', () => {
    expect(format('`code`', 'inlineCode').doc.toString()).toBe('`` `code` ``')
    expect(format('```code```', 'codeBlock').doc.toString()).toBe('````\n```code```\n````\n')
  })
  it('inserts a two-column, two-row table without merging adjacent text', () => {
    const state = format('beforeafter', 'table', 6, 6)
    expect(state.doc.toString()).toContain('before\n\n| Column 1 | Column 2 |')
    expect(state.doc.toString()).toContain('| Cell 3 | Cell 4 |\n\nafter')
    expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('Column 1')
  })
  it('selects the URL for a link and makes formatting one isolated undo action', () => {
    let state = EditorState.create({ doc: 'text', selection: { anchor: 0, head: 4 }, extensions: history() })
    state = state.update(formatSelection(state, 'link')).state
    expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('https://example.com')
    expect(undo({ state, dispatch: (tr) => { state = tr.state } })).toBe(true)
    expect(state.doc.toString()).toBe('text')
  })
})
