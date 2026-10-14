import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TemplatePicker from './TemplatePicker'
import { allTemplates, templatesByCategory } from '../templates'

function renderPicker(
  onSelect = vi.fn(),
  onClose = vi.fn(),
) {
  return render(
    <TemplatePicker onSelect={onSelect} onClose={onClose} />,
  )
}

describe('TemplatePicker', () => {
  it('renders modal title', () => {
    renderPicker()
    expect(screen.getByText('Choose a template')).toBeInTheDocument()
  })

  it('renders all templates by default (All tab active)', () => {
    renderPicker()
    // Each template card has a .template-card-name span
    const cardNames = screen.getAllByClassName
      ? [] as HTMLElement[]
      : [] as HTMLElement[]
    const nameSpans = document.querySelectorAll('.template-card-name')
    const names = Array.from(nameSpans).map((el) => el.textContent)
    for (const tpl of allTemplates) {
      expect(names).toContain(tpl.name)
    }
  })

  it('renders 6 category tabs', () => {
    renderPicker()
    for (const label of ['All', 'Blank', 'Business', 'Personal', 'Education', 'Creative']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('filters templates when clicking Business tab', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button', { name: 'Business' }))

    // Business templates visible — query by .template-card-name to avoid
    // collision with category tab labels
    const nameSpans = document.querySelectorAll('.template-card-name')
    const names = Array.from(nameSpans).map((el) => el.textContent)
    for (const tpl of templatesByCategory.business) {
      expect(names).toContain(tpl.name)
    }
    for (const tpl of templatesByCategory.personal) {
      expect(names).not.toContain(tpl.name)
    }
  })

  it('filters templates when clicking Creative tab', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button', { name: 'Creative' }))

    const nameSpans = document.querySelectorAll('.template-card-name')
    const names = Array.from(nameSpans).map((el) => el.textContent)
    for (const tpl of templatesByCategory.creative) {
      expect(names).toContain(tpl.name)
    }
    for (const tpl of templatesByCategory.business) {
      expect(names).not.toContain(tpl.name)
    }
  })

  it('calls onSelect with the template when a card is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderPicker(onSelect)

    // Click the card by its title (description tooltip)
    const card = screen.getByTitle('Agenda, attendees, decisions, and action items')
    await user.click(card)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0].id).toBe('meeting-notes')
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPicker(vi.fn(), onClose)

    await user.click(screen.getByLabelText('Close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the overlay backdrop', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPicker(vi.fn(), onClose)

    // The overlay is the outer div with role="dialog"
    const overlay = screen.getByRole('dialog')
    await user.click(overlay)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
