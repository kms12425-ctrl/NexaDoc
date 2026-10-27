import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateDocModal from './CreateDocModal'

function renderModal(initialName = '', placeholder = 'Untitled document') {
  const onConfirm = vi.fn()
  const onClose = vi.fn()

  function NamingForm() {
    const [name, setName] = useState(initialName)
    return (
      <CreateDocModal
        value={name}
        placeholder={placeholder}
        description="Give your document a name to get started."
        onChange={setName}
        onConfirm={() => onConfirm(name)}
        onClose={onClose}
      />
    )
  }

  return { ...render(<NamingForm />), onConfirm, onClose }
}

describe('CreateDocModal', () => {
  it('shows a template name as a placeholder with an empty focused value and accepts direct typing', async () => {
    const { onConfirm } = renderModal('', 'Meeting Notes')
    const input = screen.getByRole('textbox', { name: 'Document name' }) as HTMLInputElement
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(0)
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('placeholder', 'Meeting Notes')
    await userEvent.keyboard('新名称')
    expect(input).toHaveValue('新名称')
    await userEvent.keyboard('追加{Enter}')
    expect(onConfirm).toHaveBeenCalledWith('新名称追加')
  })
  it('focuses the name field and submits the current name with Enter', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderModal()
    const input = screen.getByRole('textbox', { name: 'Document name' })

    expect(input).toHaveFocus()
    await user.type(input, '项目会议纪要{Enter}')

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledWith('项目会议纪要')
  })

  it('submits an empty name unchanged so the page can apply its template default', async () => {
    const { onConfirm } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledWith('')
  })

  it('does not submit or close while confirming an IME candidate', () => {
    const { onConfirm, onClose } = renderModal()
    const input = screen.getByRole('textbox')

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Cancel without submitting', async () => {
    const { onConfirm, onClose } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes with Escape even when a button has focus', async () => {
    const { onClose } = renderModal()
    screen.getByRole('button', { name: 'Create' }).focus()

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps internal clicks inside the dialog and closes on the backdrop', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()

    await user.click(screen.getByRole('heading', { name: 'Name your document' }))
    await user.click(screen.getByRole('textbox'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps Tab and Shift+Tab navigation within the dialog', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('textbox')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Create' })).toHaveFocus()
  })

  it('restores focus to the trigger when unmounted', () => {
    render(<button type="button">Open naming dialog</button>)
    const trigger = screen.getByRole('button', { name: 'Open naming dialog' })
    trigger.focus()
    const { unmount } = renderModal()

    unmount()

    expect(trigger).toHaveFocus()
  })
})
