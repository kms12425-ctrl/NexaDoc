import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AppMenu from './AppMenu'

function Location() {
  const location = useLocation()
  return <output aria-label="Current location">{location.pathname + location.search}</output>
}

function renderMenu(current: 'docs' | 'markdown' | 'doc-editor' | 'markdown-editor' = 'docs') {
  return render(
    <MemoryRouter initialEntries={['/document/demo']}>
      <AppMenu current={current} />
      <button type="button">Outside menu</button>
      <Location />
    </MemoryRouter>,
  )
}

describe('AppMenu', () => {
  it.each([
    ['docs', 'Docs'], ['doc-editor', 'Docs'],
    ['markdown', 'Markdown'], ['markdown-editor', 'Markdown'],
  ] as const)('marks the correct workspace on %s', async (current, checked) => {
    renderMenu(current)
    const trigger = screen.getByRole('button', { name: 'Open app menu' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitemradio', { name: checked })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeDisabled()
    expect(screen.queryByRole('menuitem', { name: 'New Markdown document' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Search Markdown' })).not.toBeInTheDocument()
  })

  it.each([
    ['Docs', '/'], ['Markdown', '/markdown'],
  ])('navigates using %s and closes the menu', async (name, path) => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'Open app menu' }))
    const item = name === 'Docs' || name === 'Markdown'
      ? screen.getByRole('menuitemradio', { name })
      : screen.getByRole('menuitem', { name })

    await user.click(item)

    expect(screen.getByLabelText('Current location')).toHaveTextContent(path)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('supports arrow keys, Home/End, skips disabled items and restores focus on Escape', async () => {
    const user = userEvent.setup()
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Open app menu' })
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemradio', { name: 'Docs' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemradio', { name: 'Markdown' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Help & feedback' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitemradio', { name: 'Docs' })).toHaveFocus()
    await user.keyboard('{End}{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Help & feedback' })).toHaveFocus()
  })

  it('closes when clicking outside and leaves focus on the clicked control', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'Open app menu' }))

    const outside = screen.getByRole('button', { name: 'Outside menu' })
    await user.click(outside)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(outside).toHaveFocus()
  })

  it('closes with Tab and allows focus to leave the menu', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'Open app menu' }))

    await user.tab()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Outside menu' })).toHaveFocus()
  })

  it('opens help using an external link with opener isolation', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Open app menu' }))

    const help = screen.getByRole('menuitem', { name: 'Help & feedback' })
    expect(help).toHaveAttribute('href', 'https://github.com/kms12425-ctrl/Software-Engineering-Project/issues')
    expect(help).toHaveAttribute('target', '_blank')
    expect(help).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
