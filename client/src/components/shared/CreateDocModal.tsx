import { useEffect, useRef } from 'react'

interface CreateDocModalProps {
  value: string
  placeholder: string
  description: string
  onChange: (name: string) => void
  onConfirm: () => void
  onClose: () => void
  submitting?: boolean
  disabled?: boolean
  error?: string
}

/** Naming UI only; template selection, API calls and navigation stay in the page. */
export default function CreateDocModal({
  value, placeholder, description, onChange, onConfirm, onClose,
  submitting = false, disabled = false, error,
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
      onClick={() => { if (!submitting) onClose() }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'Escape') {
          event.preventDefault()
          if (!submitting) onClose()
        }
        if (event.key === 'Tab') {
          const controls = modalRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')
          if (!controls?.length) return
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (!Array.from(controls).includes(document.activeElement as HTMLElement)) {
            event.preventDefault()
            first.focus()
          } else if (event.shiftKey && document.activeElement === first) {
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
        {error && <p className="modal-error" role="alert">{error}</p>}
        <input
          ref={inputRef}
          className="modal-input document-name-input"
          type="text"
          placeholder={placeholder}
          value={value}
          readOnly={submitting}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter may confirm an IME candidate instead of submitting a document.
            if (event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === 'Enter') {
              event.preventDefault()
              if (!disabled && !submitting) onConfirm()
            }
          }}
          maxLength={120}
          aria-label="Document name"
        />
        <div className="modal-actions">
          <button type="button" className="modal-cancel" disabled={submitting} onClick={onClose}>Cancel</button>
          <button type="button" className="modal-create" disabled={disabled || submitting} onClick={onConfirm} id="confirm-create-doc">
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
