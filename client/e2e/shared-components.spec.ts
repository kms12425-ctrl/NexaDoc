import { test, expect, type Page } from '@playwright/test'

// C3 browser regressions use isolated API fixtures, without changing the user's database.
async function mockDocuments(page: Page) {
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort())
  const created: Array<{ name: string }> = []
  const deleted: string[] = []
  let documents = [
    { id: 'owned-notes', name: 'My Notes', createdAt: Date.now(), updatedAt: Date.now(), shared: false, previewHtml: '<p>Meeting agenda</p>' },
    { id: 'shared-notes', name: 'Team Notes', createdAt: Date.now(), updatedAt: Date.now(), shared: true, previewHtml: '<p>Team decisions</p>' },
  ]

  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({
      id: 'c3-user', username: 'c3-tester', exp: Math.floor(Date.now() / 1000) + 3600,
    }))
    sessionStorage.setItem('cdocs_token', `e30.${payload}.test-signature`)
  })
  await page.routeWebSocket('**/ws/notifications**', () => {})
  await page.routeWebSocket('**/yjs/**', () => {})
  await page.route(/\/api\/documents(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { name: string }
      created.push(body)
      await route.fulfill({ status: 201, json: {
        id: 'created-notes', name: body.name, createdAt: Date.now(), updatedAt: Date.now(), abilities: {},
      } })
    } else {
      await route.fulfill({ json: documents })
    }
  })
  await page.route('**/api/documents/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      const id = route.request().url().split('/').pop()!
      deleted.push(id)
      documents = documents.filter((doc) => doc.id !== id)
      await route.fulfill({ json: { status: 'ok' } })
    } else {
      await route.fulfill({ status: 404, json: { error: 'Document not found' } })
    }
  })
  await page.route('**/api/documents/*/metadata', (route) => route.fulfill({ json: {
    id: 'created-notes', name: created[0]?.name ?? 'My Notes',
    createdAt: Date.now(), updatedAt: Date.now(), abilities: {},
  } }))
  await page.route('**/api/documents/*/preview', (route) => route.fulfill({ json: { status: 'ok' } }))

  return { created, deleted }
}

test.describe('Shared document components', () => {
  test('renders owned/shared previews and opens a card with the keyboard', async ({ page }, testInfo) => {
    await mockDocuments(page)
    await page.goto('/')

    const owned = page.getByRole('article', { name: 'Open document: My Notes' })
    const shared = page.getByRole('article', { name: 'Open document: Team Notes' })
    await expect(owned.getByText('Meeting agenda')).toBeVisible()
    await expect(shared.getByText('Team decisions')).toBeVisible()
    await expect(shared.getByRole('button', { name: /Delete/ })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true })

    await owned.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/document\/owned-notes$/)
  })

  test('keyboard deletion stays on the home page and waits for confirmation', async ({ page }) => {
    const { deleted } = await mockDocuments(page)
    await page.goto('/')
    const removeButton = page.getByRole('button', { name: 'Delete My Notes' })
    await removeButton.focus()
    await expect(removeButton).toHaveCSS('opacity', '1')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('dialog', { name: 'Confirm delete' })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    expect(deleted).toHaveLength(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('article', { name: 'Open document: My Notes' })).toBeVisible()

    await removeButton.click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('article', { name: 'Open document: My Notes' })).toHaveCount(0)
    expect(deleted).toEqual(['owned-notes'])
  })

  test('naming dialog traps focus, cancels cleanly and restores its trigger', async ({ page }, testInfo) => {
    const { created } = await mockDocuments(page)
    await page.goto('/')
    const trigger = page.locator('#start-blank-doc')
    await trigger.click()
    const name = page.getByRole('textbox', { name: 'Document name' })
    await expect(name).toBeFocused()
    await name.fill('未提交的文档')
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(name).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath('naming-dialog.png') })
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(created).toHaveLength(0)
    await trigger.click()
    await expect(name).toHaveValue('')
    await page.mouse.click(5, 5)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(created).toHaveLength(0)
  })

  for (const scenario of [
    { label: 'blank default', template: 'blank', name: '', expected: 'Untitled document' },
    { label: 'custom Chinese name', template: 'blank', name: '  项目会议纪要  ', expected: '项目会议纪要' },
    { label: 'template default', template: 'meeting', name: '', expected: 'Meeting Notes' },
  ]) {
    test(`creates a document with ${scenario.label}`, async ({ page }) => {
      const { created } = await mockDocuments(page)
      await page.goto('/')
      if (scenario.template === 'meeting') {
        await page.getByRole('button', { name: 'Business', exact: true }).click()
        await page.getByTitle('Agenda, attendees, decisions, and action items').click()
      } else {
        await page.locator('#start-blank-doc').click()
      }
      const name = page.getByRole('textbox', { name: 'Document name' })
      await name.fill(scenario.name)
      await name.press('Enter')

      await expect(page).toHaveURL(/\/document\/created-notes$/)
      expect(created).toEqual([{ name: scenario.expected }])
    })
  }
})
