import { useCallback, useEffect, useId, useRef, useState } from 'react'

type ExportFormat = 'md' | 'html' | 'pdf' | 'docx'

const FORMATS: Array<{ id: ExportFormat; label: string }> = [
  { id: 'md', label: 'Markdown (.md)' },
  { id: 'html', label: 'HTML (.html)' },
  { id: 'pdf', label: 'PDF (.pdf)' },
  { id: 'docx', label: 'Word (.docx)' },
]

/**
 * 导出菜单（对应任务 C11 / 计划 8.8 节）。
 * 键盘可达、焦点可见、aria 正确；点击外部或 Escape 关闭。
 * 导出始终使用 `getMarkdown()`（最新未保存源码，见计划 8.8）。
 * 导出实现均按需动态 import，保持 MarkdownEditor 的懒加载 chunk 最小。
 */
export default function ExportMenu({ title, getMarkdown }: { title: string; getMarkdown: () => string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const runExport = useCallback(async (format: ExportFormat) => {
    close()
    setBusy(format)
    try {
      const markdown = getMarkdown()
      if (format === 'md') {
        const { downloadMarkdown } = await import('../../markdown/export/download')
        downloadMarkdown(title, markdown)
      } else if (format === 'html') {
        const [{ markdownToHtml }, { downloadHtml }] = await Promise.all([
          import('../../markdown/export/markdownToHtml'),
          import('../../markdown/export/download'),
        ])
        downloadHtml(title, markdownToHtml(markdown, title))
      } else if (format === 'pdf') {
        const { exportPdf } = await import('../../markdown/export/pdfExport')
        await exportPdf(title, markdown)
      } else if (format === 'docx') {
        const [{ markdownToDocxBlob }, { downloadDocx }] = await Promise.all([
          import('../../markdown/export/markdownToDocx'),
          import('../../markdown/export/download'),
        ])
        downloadDocx(title, await markdownToDocxBlob(markdown))
      }
    } finally {
      setBusy(null)
    }
  }, [title, getMarkdown])

  return (
    <div className="export-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="export-menu-trigger"
        aria-label="Export document"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          } else if (event.key === 'Escape') {
            close()
          }
        }}
      >
        Export{busy ? '…' : ' ▾'}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="export-menu-panel"
          role="menu"
          aria-label="Export formats"
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
          {FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={busy === format.id}
              onClick={() => { void runExport(format.id) }}
            >
              {format.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}





