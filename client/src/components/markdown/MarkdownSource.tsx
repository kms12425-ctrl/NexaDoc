import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete'
import type { MarkdownSession } from '../../markdown/session/MarkdownSession'

export interface MarkdownSourceHandle { insert(text: string): void; getScroller(): HTMLElement | null }

const MarkdownSource = forwardRef<MarkdownSourceHandle, { session: MarkdownSession; readOnly?: boolean; suggest?: (query: string) => Promise<Array<{ title: string; editorType: string }>> }>(function MarkdownSource({ session, readOnly = false, suggest }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableRef = useRef(new Compartment())
  const suggestionsRef = useRef(new Map<string, { expires: number; items: Array<{ title: string; editorType: string }> }>())
  useImperativeHandle(ref, () => ({
    insert(text) {
      const view = viewRef.current; if (!view) return
      const { from, to } = view.state.selection.main
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
      view.focus()
    },
    getScroller: () => viewRef.current?.scrollDOM ?? null,
  }), [])

  useEffect(() => {
    const editable = editableRef.current
    const wikiCompletion = async (context: CompletionContext) => {
      if (!suggest) return null
      const match = context.matchBefore(/\[\[[^\]|\n]*/)
      if (!match) return null
      const query = match.text.slice(2)
      try {
        const cached = suggestionsRef.current.get(query)
        const options = cached && cached.expires > Date.now() ? cached.items : await suggest(query)
        if (!cached || cached.expires <= Date.now()) suggestionsRef.current.set(query, { expires: Date.now() + 30_000, items: options })
        return { from: match.from + 2, options: options.map((item) => ({ label: item.title, detail: item.editorType === 'markdown' ? 'Markdown' : 'Rich text', apply: `[[${item.title}]]` })) }
      } catch { return null }
    }
    let replacing = false
    let compositionEndTimer: ReturnType<typeof setTimeout> | undefined
    const view = new EditorView({
      parent: containerRef.current!,
      state: EditorState.create({
        doc: session.getMarkdown(),
        extensions: [
          basicSetup,
          markdown({ codeLanguages: languages }),
          autocompletion({ override: [wikiCompletion], activateOnTyping: true }),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Markdown source', 'aria-multiline': 'true' }),
          editable.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          keymap.of([{ key: 'Mod-s', run: () => { void session.saveNow(); return true } }]),
          EditorView.domEventHandlers({
            compositionstart: () => { clearTimeout(compositionEndTimer); session.setComposing?.(true) },
            compositionend: () => {
              // Let CodeMirror consume the committed text before scheduling the save.
              compositionEndTimer = setTimeout(() => session.setComposing?.(false), 0)
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !replacing) session.update(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    const unsubscribe = session.subscribe((next) => {
      if (next === view.state.doc.toString()) return
      replacing = true
      try { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } }) }
      finally { replacing = false }
    })
    return () => {
      unsubscribe()
      clearTimeout(compositionEndTimer)
      viewRef.current = null
      view.destroy()
    }
    // Permission changes are handled by the compartment below without resetting undo/selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: editableRef.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]) })
  }, [readOnly])

  return <div ref={containerRef} className="markdown-source" />
})

export default MarkdownSource
