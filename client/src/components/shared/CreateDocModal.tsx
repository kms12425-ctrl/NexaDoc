import { useEffect, useRef } from 'react'

interface CreateDocModalProps {
  value: string
  placeholder: string
  description: string
  onChange: (name: string) => void
  onConfirm: () => void
  onClose: () => void
}

/** Naming UI only; template selection, API calls and navigation stay in the page. */
export default function CreateDocModal({
  value, placeholder, description, onChange, onConfirm, onClose,
}: CreateDocModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    inputRef.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus()
      }
    }
  }, [])

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
        if (event.key === 'Tab') {
          const controls = modalRef.current?.querySelectorAll<HTMLElement>('input, button')
          if (!controls?.length) return
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Name your document"
    >
      <div ref={modalRef} className="modal" onClick={(event) => event.stopPropagation()}>
        <h2 className="modal-title">Name your document</h2>
        <p className="modal-subtitle">{description}</p>
        <input
          ref={inputRef}
          className="modal-input"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter may confirm an IME candidate instead of submitting a document.
            if (event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === 'Enter') {
              event.preventDefault()
              onConfirm()
            }
          }}
          maxLength={120}
          aria-label="Document name"
        />
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="modal-create" onClick={onConfirm} id="confirm-create-doc">
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
