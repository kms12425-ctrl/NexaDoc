import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import type { MarkdownSession } from '../../markdown/session/MarkdownSession'

export default function MarkdownSource({ session, readOnly = false }: { session: MarkdownSession; readOnly?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableRef = useRef(new Compartment())

  useEffect(() => {
    const editable = editableRef.current
    let replacing = false
    let compositionEndTimer: ReturnType<typeof setTimeout> | undefined
    const view = new EditorView({
      parent: containerRef.current!,
      state: EditorState.create({
        doc: session.getMarkdown(),
        extensions: [
          basicSetup,
          markdown({ codeLanguages: languages }),
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
}
