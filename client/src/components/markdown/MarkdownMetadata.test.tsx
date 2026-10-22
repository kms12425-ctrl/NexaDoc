import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MarkdownMetadata from './MarkdownMetadata'
import { documentsApi, type DocumentWithAbilities } from '../../services/api'

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout }) }))
vi.mock('../../services/api', () => ({ documentsApi: { updateMetadata: vi.fn() } }))
const update = vi.mocked(documentsApi.updateMetadata)
const metadata: DocumentWithAbilities = { id: 'doc', name: 'Original', editorType: 'markdown', tags: ['工作'], createdAt: 1, updatedAt: 2, abilities: { canEdit: true } }
function setup(readOnly = false) {
  const onSaved = vi.fn()
  const result = render(<MarkdownMetadata metadata={metadata} readOnly={readOnly} onSaved={onSaved} />)
  return { ...result, onSaved }
}
beforeEach(() => { vi.clearAllMocks(); update.mockResolvedValue({ ...metadata, status: 'ok' }) })

describe('Markdown title and tag editing', () => {
  it('saves a trimmed title separately from the body and uses the canonical response', async () => {
    update.mockResolvedValue({ ...metadata, name: 'New title', status: 'ok' })
    const { onSaved } = setup()
    await userEvent.clear(screen.getByLabelText('Document title'))
    await userEvent.type(screen.getByLabelText('Document title'), ' New title ')
    await userEvent.click(screen.getByRole('button', { name: 'Save title' }))
    expect(update).toHaveBeenCalledWith('doc', { title: 'New title' })
    expect(onSaved).toHaveBeenCalledWith({ name: 'New title', tags: ['工作'] })
    expect(screen.getByLabelText('Document title')).toHaveValue('New title')
  })
  it('adds a normalized tag and replaces the full array when removing one', async () => {
    update.mockResolvedValueOnce({ ...metadata, tags: ['工作', 'New tag'], status: 'ok' }).mockResolvedValueOnce({ ...metadata, tags: ['New tag'], status: 'ok' })
    setup()
    await userEvent.type(screen.getByRole('textbox', { name: 'Add tag' }), '#New   tag{Enter}')
    expect(update).toHaveBeenNthCalledWith(1, 'doc', { tags: ['工作', 'New tag'] })
    await userEvent.click(screen.getByRole('button', { name: 'Remove tag 工作' }))
    expect(update).toHaveBeenNthCalledWith(2, 'doc', { tags: ['New tag'] })
    expect(screen.queryByRole('button', { name: 'Remove tag 工作' })).not.toBeInTheDocument()
  })
  it('preserves a failed tag input and existing tags for retry', async () => {
    update.mockRejectedValueOnce(new Error('Network unavailable'))
    setup()
    await userEvent.type(screen.getByRole('textbox', { name: 'Add tag' }), 'Retry me{Enter}')
    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: 'Add tag' })).toHaveValue('Retry me')
    expect(screen.getByRole('button', { name: 'Remove tag 工作' })).toBeInTheDocument()
    update.mockResolvedValueOnce({ ...metadata, tags: ['工作', 'Retry me'], status: 'ok' })
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Add tag' })).toHaveValue(''))
  })
  it('rejects duplicate or too-long tags without a request', async () => {
    setup()
    const input = screen.getByRole('textbox', { name: 'Add tag' })
    await userEvent.type(input, '#工作{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('already exists')
    await userEvent.clear(input); await userEvent.type(input, 'x'.repeat(31) + '{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('1–30')
    expect(update).not.toHaveBeenCalled()
  })
  it('does not submit candidate text during Chinese composition', async () => {
    setup()
    const input = screen.getByRole('textbox', { name: 'Add tag' })
    fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: 'zhong' } })
    fireEvent.submit(input.closest('form')!)
    expect(update).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input); fireEvent.change(input, { target: { value: '中文' } })
    fireEvent.submit(input.closest('form')!)
    expect(update).toHaveBeenCalledWith('doc', { tags: ['工作', '中文'] })
    await screen.findByText('Details saved')
  })
  it('blocks duplicate submissions while saving and avoids callbacks after unmount', async () => {
    let finish!: (value: Awaited<ReturnType<typeof documentsApi.updateMetadata>>) => void
    update.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const { unmount, onSaved } = setup()
    const input = screen.getByRole('textbox', { name: 'Add tag' })
    fireEvent.change(input, { target: { value: 'New' } })
    fireEvent.submit(input.closest('form')!); fireEvent.submit(input.closest('form')!)
    expect(update).toHaveBeenCalledTimes(1)
    expect(input).toBeDisabled()
    unmount()
    await act(async () => { finish({ ...metadata, status: 'ok' }) })
    expect(onSaved).not.toHaveBeenCalled()
  })
  it('exposes read-only details without edit actions', () => {
    setup(true)
    expect(screen.getByLabelText('Document title')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Document tags')).toHaveTextContent('工作')
  })
  it('logs out on an unauthorized metadata save', async () => {
    update.mockRejectedValueOnce(new Error('Unauthorized'))
    setup()
    await userEvent.type(screen.getByRole('textbox', { name: 'Add tag' }), 'New{Enter}')
    expect(logout).toHaveBeenCalledOnce()
  })
})
