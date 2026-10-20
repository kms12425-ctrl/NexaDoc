import { test, expect, type Page } from '@playwright/test'
import { markdownTemplates } from '../src/templates/markdown'

async function mockMarkdownHome(page: Page) {
  // Keep mocked UI tests independent of Google's external font servers.
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort())
  const created: Array<{ name: string; editorType: string; markdown: string; tags: string[] }> = []
  const deleted: string[] = []
  const dataRequests: string[] = []
  const listTypes: Array<string | null> = []
  const initial = { id: 'md-plan', name: 'Project Plan', editorType: 'markdown', createdAt: 1, updatedAt: 2, tags: ['项目'], snippet: 'Plan the next milestone.', abilities: { canView: true, canEdit: true, canDelete: true } }
  const rows = [initial, { ...initial, id: 'md-cn', name: '会议纪要', updatedAt: 1 }]
  let createFailures = 0
  let listFailures = 0
  let createGate: Promise<void> | undefined

  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({ id: 'c45-user', username: 'markdown-tester', exp: Math.floor(Date.now() / 1000) + 3600 }))
    sessionStorage.setItem('cdocs_token', `e30.${payload}.signature`)
  })
  await page.routeWebSocket('**/ws/notifications**', () => {})
  await page.routeWebSocket('**/yjs/**', () => {})
  await page.route(/\/api\/documents(?:\?.*)?$/, async (route) => {
    dataRequests.push(route.request().method())
    if (route.request().method() === 'POST') {
      created.push(route.request().postDataJSON())
      if (createGate) await createGate
      if (createFailures-- > 0) {
        await route.fulfill({ status: 503, json: { error: 'Please retry creation' } })
      } else {
        await route.fulfill({ status: 201, json: { ...initial, id: 'md-created', name: created[created.length - 1].name, revision: 0 } })
      }
    } else {
      listTypes.push(new URL(route.request().url()).searchParams.get('type'))
      if (listFailures-- > 0) {
        await route.fulfill({ status: 503, json: { error: 'List temporarily unavailable' } })
      } else {
        await route.fulfill({ json: [
          ...rows.filter((row) => !deleted.includes(row.id)),
          { ...initial, id: 'rich', name: 'Rich document', editorType: 'rich' },
          { ...initial, id: 'shared', name: 'Shared document', shared: true },
        ] })
      }
    }
  })
  await page.route('**/api/documents/*/metadata', (route) => route.fulfill({ json: { ...initial, id: 'md-created', name: created.at(-1)?.name ?? initial.name } }))
  await page.route('**/api/documents/*/markdown', (route) => route.fulfill({ json: { markdown: created.at(-1)?.markdown ?? '# Project Plan', revision: 0, updatedAt: 1 } }))
  await page.route('**/api/documents/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      deleted.push(new URL(route.request().url()).pathname.split('/').pop()!)
      await route.fulfill({ json: { status: 'ok' } })
    } else { await route.fulfill({ status: 404, json: { error: 'Not found' } }) }
  })
  return {
    created, deleted, dataRequests, listTypes,
    failCreation: () => { createFailures = 1 },
    failList: () => { listFailures = 1 },
    delayCreation: (gate: Promise<void>) => { createGate = gate },
  }
}

test.describe('Markdown home and templates', () => {
  test('shows the shared layout, own documents and five template categories', async ({ page }, testInfo) => {
    const fixtures = await mockMarkdownHome(page)
    await page.goto('/markdown')

    await expect(page.getByRole('article', { name: 'Open document: Project Plan' })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(2)
    expect(fixtures.listTypes).toEqual(['markdown'])
    await expect(page.getByText('Shared with me', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Template categories' }).getByRole('button')).toHaveCount(5)
    await page.getByRole('group', { name: 'Template categories' }).getByRole('button', { name: 'Business' }).click()
    await expect(page.getByRole('button', { name: 'Meeting Notes', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Weekly Report', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('markdown-home.png'), fullPage: true, animations: 'disabled' })
  })

  test('selects each of the seven templates and sends its exact source', async ({ page }) => {
    test.setTimeout(60000)
    const fixtures = await mockMarkdownHome(page)
    for (const template of markdownTemplates) {
      await page.goto('/markdown')
      await page.getByRole('button', { name: 'New document', exact: true }).click()
      const picker = page.getByRole('dialog', { name: 'Choose a Markdown template' })
      await picker.getByRole('button', { name: new RegExp(`^${template.name}`) }).click()
      const input = page.getByRole('textbox', { name: 'Document name' })
      await input.fill(`测试 ${template.name}`)
      await input.press('Enter')
      await expect(page).toHaveURL(/\/markdown\/md-created$/)
      expect(fixtures.created.at(-1)).toEqual({ name: `测试 ${template.name}`, editorType: 'markdown', markdown: template.markdown, tags: [] })
    }
    expect(fixtures.created).toHaveLength(7)
  })

  test('supports picker categories, keyboard cancellation and empty-name defaults', async ({ page }) => {
    const fixtures = await mockMarkdownHome(page)
    await page.goto('/markdown')
    const newDocument = page.getByRole('button', { name: 'New document', exact: true })
    await newDocument.click()
    const picker = page.getByRole('dialog', { name: 'Choose a Markdown template' })
    await picker.getByRole('button', { name: 'Personal', exact: true }).click()
    await expect(picker.locator('.template-card')).toHaveCount(2)
    await page.keyboard.press('Escape')
    await expect(newDocument).toBeFocused()
    expect(fixtures.created).toHaveLength(0)

    await page.getByRole('button', { name: 'Blank Markdown', exact: true }).click()
    await page.getByRole('textbox', { name: 'Document name' }).press('Enter')
    await expect(page).toHaveURL(/\/markdown\/md-created$/)
    expect(fixtures.created[0]).toEqual({ name: 'Untitled document', editorType: 'markdown', markdown: '', tags: [] })
  })

  test('keeps creation failures recoverable and sends only one pending request', async ({ page }) => {
    const fixtures = await mockMarkdownHome(page)
    fixtures.failCreation()
    await page.goto('/markdown')
    await page.getByRole('button', { name: 'Blank Markdown', exact: true }).click()
    await page.getByRole('textbox', { name: 'Document name' }).fill('保留我的名称')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Please retry creation')
    await expect(page.getByRole('textbox', { name: 'Document name' })).toHaveValue('保留我的名称')

    let finish!: () => void
    fixtures.delayCreation(new Promise<void>((resolve) => { finish = resolve }))
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    try {
      await expect(page.getByRole('button', { name: 'Creating…' })).toBeDisabled()
      const input = page.getByRole('textbox', { name: 'Document name' })
      await input.focus()
      await input.press('Enter')
      await expect.poll(() => fixtures.created.length).toBe(2)
    } finally { finish() }
    await expect(page).toHaveURL(/\/markdown\/md-created$/)
    expect(fixtures.created).toHaveLength(2)
  })

  test('filters Chinese titles and updates the URL without a full-text-search request', async ({ page }) => {
    await mockMarkdownHome(page)
    await page.goto('/markdown?q=project')
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page.getByRole('article', { name: 'Open document: Project Plan' })).toBeVisible()
    const search = page.getByRole('searchbox', { name: 'Search Markdown' })
    await search.fill('会议')
    await expect(page.getByRole('article', { name: 'Open document: 会议纪要' })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page).toHaveURL(/q=/)
    await search.press('Escape')
    await expect(page.getByRole('article')).toHaveCount(2)
    await expect(page).toHaveURL(/\/markdown$/)
  })

  test('opens a document and removes it only after deletion is confirmed', async ({ page }) => {
    const fixtures = await mockMarkdownHome(page)
    await page.goto('/markdown')
    const card = page.getByRole('article', { name: 'Open document: Project Plan' })
    await card.click()
    await expect(page).toHaveURL(/\/markdown\/md-plan$/)
    await page.goto('/markdown')
    await card.getByRole('button', { name: 'Delete Project Plan' }).click()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(fixtures.deleted).toHaveLength(0)
    await card.getByRole('button', { name: 'Delete Project Plan' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(card).toHaveCount(0)
    expect(fixtures.deleted).toEqual(['md-plan'])
  })

  test('recovers from list failures and retains the gallery', async ({ page }) => {
    const fixtures = await mockMarkdownHome(page)
    fixtures.failList()
    await page.goto('/markdown')
    await expect(page.getByRole('alert')).toHaveText(/List temporarily unavailable/)
    await expect(page.getByRole('button', { name: 'Blank Markdown', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('article')).toHaveCount(2)
  })

  test('keeps the home and picker usable at 375px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockMarkdownHome(page)
    await page.goto('/markdown')
    await expect(page.getByRole('article')).toHaveCount(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const searchBounds = await page.getByRole('searchbox').boundingBox()
    expect(searchBounds!.width).toBeGreaterThan(100)
    await page.screenshot({ path: testInfo.outputPath('markdown-home-mobile.png'), animations: 'disabled' })
    await page.getByRole('button', { name: 'New document', exact: true }).click()
    const picker = page.getByRole('dialog', { name: 'Choose a Markdown template' })
    await expect(picker).toBeVisible()
    const bounds = await picker.locator('.modal').boundingBox()
    expect(bounds!.width).toBeLessThanOrEqual(375)
    await page.screenshot({ path: testInfo.outputPath('markdown-picker-mobile.png'), animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'New document', exact: true })).toBeFocused()
  })

  test('explicitly disabled production build allows template browsing without sending data requests', async ({ page }) => {
    const fixtures = await mockMarkdownHome(page)
    await page.goto('http://127.0.0.1:5187/markdown')
    await expect(page.getByRole('status')).toHaveText(/creation and storage are not available/)
    await page.getByRole('button', { name: 'Blank Markdown', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled()
    expect(fixtures.dataRequests).toHaveLength(0)
  })
})
