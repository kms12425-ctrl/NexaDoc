import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorToolbar } from './EditorToolbar'

function createMockEditor(overrides: Partial<any> = {}): any {
  const chain = {
    focus: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleItalic: vi.fn().mockReturnThis(),
    toggleUnderline: vi.fn().mockReturnThis(),
    toggleStrike: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    unsetColor: vi.fn().mockReturnThis(),
    toggleHighlight: vi.fn().mockReturnThis(),
    setMark: vi.fn().mockReturnThis(),
    extendMarkRange: vi.fn().mockReturnThis(),
    setLink: vi.fn().mockReturnThis(),
    unsetLink: vi.fn().mockReturnThis(),
    run: vi.fn(),
  }

  return {
    isActive: vi.fn(() => false),
    getAttributes: vi.fn(() => ({})),
    chain: vi.fn(() => chain),
    commands: {
      setFontSize: vi.fn(),
    },
    ...overrides,
  }
}

describe('EditorToolbar', () => {
  it('returns null when editor is null', () => {
    const { container } = render(<EditorToolbar editor={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders font family and font size selects', () => {
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)
    expect(screen.getByTitle('Font family')).toBeInTheDocument()
    expect(screen.getByTitle('Font size')).toBeInTheDocument()
  })

  it('renders formatting buttons (Bold, Italic, Underline, Strike)', () => {
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument()
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument()
    expect(screen.getByTitle('Underline (Ctrl+U)')).toBeInTheDocument()
    expect(screen.getByTitle('Strikethrough')).toBeInTheDocument()
  })

  it('clicking Bold calls editor.chain().focus().toggleBold().run()', async () => {
    const user = userEvent.setup()
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)

    await user.click(screen.getByTitle('Bold (Ctrl+B)'))

    expect(editor.chain).toHaveBeenCalled()
    expect(editor.chain().focus).toHaveBeenCalled()
    expect(editor.chain().toggleBold).toHaveBeenCalled()
    expect(editor.chain().run).toHaveBeenCalled()
  })

  it('clicking Italic calls toggleItalic', async () => {
    const user = userEvent.setup()
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)

    await user.click(screen.getByTitle('Italic (Ctrl+I)'))
    expect(editor.chain().toggleItalic).toHaveBeenCalled()
  })

  it('clicking Underline calls toggleUnderline', async () => {
    const user = userEvent.setup()
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)

    await user.click(screen.getByTitle('Underline (Ctrl+U)'))
    expect(editor.chain().toggleUnderline).toHaveBeenCalled()
  })

  it('clicking Strikethrough calls toggleStrike', async () => {
    const user = userEvent.setup()
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)

    await user.click(screen.getByTitle('Strikethrough'))
    expect(editor.chain().toggleStrike).toHaveBeenCalled()
  })

  it('bold button has is-active class when editor.isActive("bold") is true', () => {
    const editor = createMockEditor({
      isActive: vi.fn((name: string) => name === 'bold'),
    })
    render(<EditorToolbar editor={editor} />)
    expect(screen.getByTitle('Bold (Ctrl+B)')).toHaveClass('is-active')
  })

  it('changing font family select calls setMark with textStyle', async () => {
    const user = userEvent.setup()
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)

    const select = screen.getByTitle('Font family')
    await user.selectOptions(select, 'Arial, sans-serif')

    expect(editor.chain().setMark).toHaveBeenCalledWith('textStyle', { fontFamily: 'Arial, sans-serif' })
  })

  it('changing font size select calls editor.commands.setFontSize', async () => {
    const user = userEvent.setup()
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)

    const select = screen.getByTitle('Font size')
    await user.selectOptions(select, '14pt')

    expect(editor.commands.setFontSize).toHaveBeenCalledWith('14pt')
  })

  it('changing text color calls setColor', () => {
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)

    const colorInput = screen.getByTitle('Text colour') as HTMLInputElement
    fireEvent.change(colorInput, { target: { value: '#ff0000' } })

    expect(editor.chain().setColor).toHaveBeenCalledWith('#ff0000')
  })

  it('renders link button', () => {
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)
    expect(screen.getByTitle('Insert link')).toBeInTheDocument()
  })

  it('clicking clear text colour calls unsetColor', async () => {
    const user = userEvent.setup()
    const editor = createMockEditor()
    render(<EditorToolbar editor={editor} />)

    await user.click(screen.getByTitle('Clear text colour'))
    expect(editor.chain().unsetColor).toHaveBeenCalled()
  })
})
