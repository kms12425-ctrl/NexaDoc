import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import type { MarkdownSession } from '../../markdown/session/MarkdownSession'
import { applyMarkdownFormat } from '../../markdown/formatting'

interface Props {
  session: MarkdownSession
  readOnly?: boolean
  onView?: (view: EditorView | null) => void
  onCursor?: (cursor: { line: number; column: number }) => void
  onTogglePreview?: () => void
}

export default function MarkdownSource({ session, readOnly = false, ...callbacks }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableRef = useRef(new Compartment())
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

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
          Prec.highest(keymap.of([
            { key: 'Mod-s', run: () => { void session.saveNow(); return true } },
            { key: 'Mod-b', run: (view) => applyMarkdownFormat(view, 'bold') },
            { key: 'Mod-i', run: (view) => applyMarkdownFormat(view, 'italic') },
            { key: 'Mod-k', run: (view) => applyMarkdownFormat(view, 'link') },
            { key: 'Mod-Shift-p', run: () => { callbacksRef.current.onTogglePreview?.(); return true } },
          ])),
          EditorView.domEventHandlers({
            compositionstart: () => { clearTimeout(compositionEndTimer); session.setComposing?.(true) },
            compositionend: () => {
              // Let CodeMirror consume the committed text before scheduling the save.
              compositionEndTimer = setTimeout(() => session.setComposing?.(false), 0)
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !replacing) session.update(update.state.doc.toString())
            if (update.docChanged || update.selectionSet) {
              const head = update.state.selection.main.head
              const line = update.state.doc.lineAt(head)
              callbacksRef.current.onCursor?.({ line: line.number, column: head - line.from + 1 })
            }
          }),
        ],
      }),
    })
    viewRef.current = view
    callbacksRef.current.onView?.(view)
    callbacksRef.current.onCursor?.({ line: 1, column: 1 })
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
      callbacksRef.current.onView?.(null)
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
