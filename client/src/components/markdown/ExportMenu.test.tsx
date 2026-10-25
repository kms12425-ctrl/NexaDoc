import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportMenu from './ExportMenu'

const downloadMarkdown = vi.fn()
const downloadHtml = vi.fn()
const downloadDocx = vi.fn()
const markdownToHtml = vi.fn((markdown: string) => `<html>${markdown}</html>`)
const markdownToDocxBlob = vi.fn(async () => new Blob(['docx'], { type: 'application/zip' }))
const exportPdf = vi.fn(async () => {})

vi.mock('../../markdown/export/download', () => ({ downloadMarkdown, downloadHtml, downloadDocx }))
vi.mock('../../markdown/export/markdownToHtml', () => ({ markdownToHtml }))
vi.mock('../../markdown/export/markdownToDocx', () => ({ markdownToDocxBlob }))
vi.mock('../../markdown/export/pdfExport', () => ({ exportPdf }))

beforeEach(() => {
  vi.clearAllMocks()
  markdownToHtml.mockImplementation((markdown: string) => `<html>${markdown}</html>`)
  markdownToDocxBlob.mockResolvedValue(new Blob(['docx'], { type: 'application/zip' }))
})

describe('ExportMenu', () => {
  it('opens the menu and lists four formats with correct roles', async () => {
    render(<ExportMenu title="Doc" getMarkdown={() => '# content'} />)
    const trigger = screen.getByRole('button', { name: 'Export document' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(trigger)
    expect(screen.getByRole('menu', { name: 'Export formats' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Markdown (.md)' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'HTML (.html)' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'PDF (.pdf)' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Word (.docx)' })).toBeInTheDocument()
  })

  it('exports Markdown using the latest unsaved source', async () => {
    render(<ExportMenu title="Doc" getMarkdown={() => '# latest'} />)
    await userEvent.click(screen.getByRole('button', { name: 'Export document' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Markdown (.md)' }))
    await waitFor(() => expect(downloadMarkdown).toHaveBeenCalledWith('Doc', '# latest'))
  })

  it('exports HTML via the static renderer', async () => {
    render(<ExportMenu title="Doc" getMarkdown={() => '# html'} />)
    await userEvent.click(screen.getByRole('button', { name: 'Export document' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'HTML (.html)' }))
    await waitFor(() => {
      expect(markdownToHtml).toHaveBeenCalledWith('# html', 'Doc')
      expect(downloadHtml).toHaveBeenCalled()
    })
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    render(<ExportMenu title="Doc" getMarkdown={() => ''} />)
    const trigger = screen.getByRole('button', { name: 'Export document' })
    await userEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('supports ArrowDown keyboard opening and menu item focus', async () => {
    render(<ExportMenu title="Doc" getMarkdown={() => ''} />)
    const trigger = screen.getByRole('button', { name: 'Export document' })
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menu', { name: 'Export formats' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Markdown (.md)' })).toHaveFocus()
  })
})
