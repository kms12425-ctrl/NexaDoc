import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentCard from './DocumentCard'

const doc = {
  id: 'meeting-notes-123',
  name: 'Meeting Notes',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('DocumentCard', () => {
  it('renders a supplied preview, tags and highlighted snippet', () => {
    render(
      <DocumentCard
        doc={doc}
        preview={<span>Markdown preview</span>}
        tags={['会议', 'Work']}
        snippet={<>Discuss <mark>milestones</mark> tomorrow.</>}
        onOpen={vi.fn()}
      />
    )

    expect(screen.getByText('Meeting Notes')).toBeInTheDocument()
    expect(screen.getByText('Markdown preview')).toBeInTheDocument()
    expect(screen.getByText('#会议')).toBeInTheDocument()
    expect(screen.getByText('#Work')).toBeInTheDocument()
    expect(screen.getByText('milestones').tagName).toBe('MARK')
    expect(screen.getByText('Just now')).toBeInTheDocument()
  })

  it('opens the document when clicked', async () => {
    const onOpen = vi.fn()
    render(<DocumentCard doc={doc} preview={null} onOpen={onOpen} />)

    await userEvent.click(screen.getByRole('article', { name: 'Open document: Meeting Notes' }))

    expect(onOpen).toHaveBeenCalledOnce()
  })

  it.each(['{Enter}', ' '])('opens a focused card using %s', async (key) => {
    const onOpen = vi.fn()
    render(<DocumentCard doc={doc} preview={null} onOpen={onOpen} />)
    screen.getByRole('article').focus()

    await userEvent.keyboard(key)

    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('deletes with mouse or keyboard without opening the document', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onDelete = vi.fn()
    render(<DocumentCard doc={doc} preview={null} onOpen={onOpen} onDelete={onDelete} />)
    const deleteButton = screen.getByRole('button', { name: 'Delete Meeting Notes' })

    await user.click(deleteButton)
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onDelete).toHaveBeenCalledTimes(3)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('renders a shared card without a delete action or document ID', () => {
    render(<DocumentCard doc={doc} shared preview={null} onOpen={vi.fn()} />)

    expect(screen.getByRole('article')).toHaveClass('shared-card')
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.queryByText('meeting-note…')).not.toBeInTheDocument()
  })
})
