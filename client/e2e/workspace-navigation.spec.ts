import { test, expect, type Page } from '@playwright/test'
import type { DocumentWithAbilities } from '../src/services/api'

async function mockWorkspace(page: Page, options: { authenticated?: boolean; metadataGate?: Promise<void> } = {}) {
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort())
  const rich: DocumentWithAbilities = {
    id: 'rich-note', name: 'Rich note', createdAt: 1, updatedAt: 1,
    editorType: 'rich', abilities: { canView: true, canEdit: true },
  }
  const metadata: Record<string, DocumentWithAbilities> = {
    'rich-note': rich,
    'md-note': { ...rich, id: 'md-note', name: 'Markdown note', editorType: 'markdown' },
    'legacy-note': { ...rich, id: 'legacy-note', name: 'Legacy note', editorType: undefined },
    'readonly-note': { ...rich, id: 'readonly-note', name: 'Read-only note', abilities: { canView: true, canEdit: false } },
  }
  const sockets: string[] = []
  const metadataRequests: string[] = []
  if (options.authenticated !== false) {
    await page.addInitScript(() => {
      const payload = btoa(JSON.stringify({ id: 'nav-user', username: 'navigation-tester', exp: Math.floor(Date.now() / 1000) + 3600 }))
      sessionStorage.setItem('cdocs_token', `e30.${payload}.test-signature`)
    })
  }
  await page.routeWebSocket('**/ws/notifications**', () => {})
  await page.routeWebSocket('**/yjs/**', (socket) => { sockets.push(socket.url()) })
  await page.route(/\/api\/documents(?:\?.*)?$/, (route) => route.fulfill({ json: [
    { ...rich, shared: false },
    { ...metadata['legacy-note'], shared: false },
    { ...metadata['md-note'], shared: false },
  ] }))
  await page.route('**/api/documents/*/metadata', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').slice(-2)[0]
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ json: { status: 'ok' } })
      return
    }
    metadataRequests.push(id)
    if (options.metadataGate) await options.metadataGate
    await route.fulfill(metadata[id]
      ? { json: metadata[id] }
      : { status: 404, json: { error: 'Document not found' } })
  })
  await page.route('**/api/documents/*/preview', (route) => route.fulfill({ json: { status: 'ok' } }))
  await page.route('**/api/documents/*/markdown', (route) => route.fulfill({ json: { markdown: '# Markdown note', revision: 0, updatedAt: 1 } }))
  return { rich, metadata, sockets, metadataRequests }
}

test.describe('Workspace navigation', () => {
  test('switches workspaces, lazy-loads Markdown and keeps document actions on its home page', async ({ page }, testInfo) => {
    const scripts: string[] = []
    page.on('request', (request) => { if (request.resourceType() === 'script') scripts.push(request.url()) })
    await mockWorkspace(page)
    await page.goto('/')
    await expect(page.getByRole('article', { name: 'Open document: Rich note' })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Open document: Markdown note' })).toHaveCount(0)
    expect(scripts.some((url) => /MarkdownHome-.*\.js/.test(url))).toBe(false)

    await page.getByRole('button', { name: 'Open app menu' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Docs', exact: true })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('menuitemradio', { name: 'Markdown', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your Markdown workspace' })).toBeVisible()
    // In production this proves the workspace code was fetched only on navigation.
    if (scripts.some((url) => /\/assets\//.test(url))) {
      expect(scripts.some((url) => /MarkdownHome-.*\.js/.test(url))).toBe(true)
    }

    await page.getByRole('button', { name: 'Open app menu' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Markdown', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('menuitem', { name: 'Search Markdown' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'New Markdown document' })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('markdown-menu.png') })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('searchbox', { name: 'Search Markdown' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New document' })).toBeEnabled()
    await page.getByRole('button', { name: 'Open app menu' }).click()
    await page.getByRole('menuitemradio', { name: 'Docs', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  for (const path of ['/markdown', '/markdown/md-note']) {
    test(`requires authentication at ${path}`, async ({ page }) => {
      const { sockets, metadataRequests } = await mockWorkspace(page, { authenticated: false })
      await page.goto(path)

      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
      expect(sockets).toHaveLength(0)
      expect(metadataRequests).toHaveLength(0)
    })
  }

  test('redirects Markdown to its source editor without opening a Yjs room', async ({ page }) => {
    const { sockets } = await mockWorkspace(page)
    await page.goto('/document/md-note?from=search#heading')

    await expect(page).toHaveURL(/\/markdown\/md-note\?from=search#heading$/)
    await expect(page.getByRole('banner').getByRole('heading', { name: 'Markdown note' })).toBeVisible()
    expect(sockets).toHaveLength(0)
    await expect(page.locator('.ProseMirror')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Share|Comments|History)$/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Open app menu' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Markdown', exact: true })).toHaveAttribute('aria-checked', 'true')
  })

  test('redirects legacy documents to the rich editor with its menu', async ({ page }) => {
    const { sockets } = await mockWorkspace(page)
    await page.goto('/markdown/legacy-note')

    await expect(page).toHaveURL(/\/document\/legacy-note$/)
    await expect(page.locator('.ProseMirror')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('Legacy note')
    expect(sockets.every((url) => url.includes('/legacy-note?'))).toBe(true)
    await page.getByRole('button', { name: 'Open app menu' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Docs', exact: true })).toHaveAttribute('aria-checked', 'true')
  })

  test('waits for document metadata before initializing the rich editor', async ({ page }) => {
    let release!: () => void
    const metadataGate = new Promise<void>((resolve) => { release = resolve })
    const { sockets } = await mockWorkspace(page, { metadataGate })
    await page.goto('/document/rich-note')

    await expect(page.getByRole('status')).toHaveText('Opening document…')
    expect(sockets).toHaveLength(0)
    await expect(page.locator('.ProseMirror')).toHaveCount(0)
    release()
    await expect(page.locator('.ProseMirror')).toBeVisible()
    await expect.poll(() => sockets.length).toBe(1)
  })

  test('keeps a reader document read-only after guarded initialization', async ({ page }) => {
    await mockWorkspace(page)
    await page.goto('/document/readonly-note')

    await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false')
    await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveAttribute('readonly', '')
    await expect(page.locator('.mode-btn')).toHaveText('Viewing')
    await expect(page.getByRole('button', { name: 'Open app menu' })).toBeVisible()
  })

  test('shows errors without creating an editor and can retry successfully', async ({ page }) => {
    const { metadata, rich, sockets } = await mockWorkspace(page)
    await page.goto('/document/missing-note')

    await expect(page.getByRole('heading', { name: 'Unable to open document' })).toBeVisible()
    expect(sockets).toHaveLength(0)
    metadata['missing-note'] = { ...rich, id: 'missing-note' }
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('.ProseMirror')).toBeVisible()
  })

  test('supports keyboard navigation and a menu that fits a 375px screen', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockWorkspace(page)
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Open app menu' })
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('menuitemradio', { name: 'Docs', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('menuitemradio', { name: 'Markdown', exact: true })).toBeFocused()
    const bounds = await page.getByRole('menu').boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375)
    await page.screenshot({ path: testInfo.outputPath('mobile-menu.png') })
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await trigger.click()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(trigger).not.toBeFocused()
  })
})
