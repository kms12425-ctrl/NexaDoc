import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface AppMenuProps {
  current: 'docs' | 'markdown' | 'doc-editor' | 'markdown-editor'
}

export default function AppMenu({ current }: AppMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const focusLastRef = useRef(false)
  const menuId = useId()
  const navigate = useNavigate()
  const location = useLocation()
  const isMarkdown = current === 'markdown' || current === 'markdown-editor'

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>(
    '[role="menuitemradio"], [role="menuitem"]:not([disabled])',
  ) ?? [])

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const go = (path: string) => {
    close()
    navigate(path)
  }

  useEffect(() => {
    if (!open) return
    const controls = items()
    controls[focusLastRef.current ? controls.length - 1 : 0]?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => { setOpen(false) }, [location.pathname, location.search])

  return (
    <div className="app-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="app-menu-trigger"
        aria-label="Open app menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          focusLastRef.current = false
          setOpen(!open)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            focusLastRef.current = event.key === 'ArrowUp'
            setOpen(true)
          } else if (event.key === 'Escape') {
            close()
          }
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="app-menu-panel"
          role="menu"
          aria-label="Workspaces"
          onKeyDown={(event) => {
            const controls = items()
            const index = controls.indexOf(document.activeElement as HTMLElement)
            let next: number | undefined
            if (event.key === 'ArrowDown') next = (index + 1) % controls.length
            if (event.key === 'ArrowUp') next = (index - 1 + controls.length) % controls.length
            if (event.key === 'Home') next = 0
            if (event.key === 'End') next = controls.length - 1
            if (next !== undefined) {
              event.preventDefault()
              controls[next]?.focus()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close()
            } else if (event.key === 'Tab') {
              close()
            }
          }}
        >
          <p className="app-menu-brand" role="presentation">NexaDoc</p>
          <button type="button" role="menuitemradio" aria-checked={!isMarkdown} tabIndex={-1} onClick={() => go('/')}>
            <span>Docs</span><span aria-hidden="true">{!isMarkdown && '✓'}</span>
          </button>
          <button type="button" role="menuitemradio" aria-checked={isMarkdown} tabIndex={-1} onClick={() => go('/markdown')}>
            <span>Markdown</span><span aria-hidden="true">{isMarkdown && '✓'}</span>
          </button>
          <div role="separator" className="app-menu-divider" />
          <button type="button" role="menuitem" tabIndex={-1} disabled>Settings</button>
          <a role="menuitem" tabIndex={-1} href="https://github.com/kms12425-ctrl/Software-Engineering-Project/issues" target="_blank" rel="noopener noreferrer" onClick={() => close()}>Help &amp; feedback</a>
          <p className="app-menu-footer" role="presentation">Privacy Policy · Terms of Service</p>
        </div>
      )}
    </div>
  )
}
