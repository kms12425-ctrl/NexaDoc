import { createRequire } from 'node:module'
import path from 'node:path'
import { test, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test'

const WebSocket = createRequire(path.resolve('../server/package.json'))('ws')

type Account = { token: string; user: { id: string; username: string } }
let owner: Account, guest: Account, outsider: Account, id: string
const headers = (user: Account) => ({ Authorization: `Bearer ${user.token}` })
const uri = (suffix = '') => `/api/documents/${id}${suffix}`
async function invite(request: APIRequestContext, role: string) {
  const response = await request.post(uri('/share'), { headers: headers(owner), data: { username: guest.user.username, role } })
  expect(response.status()).toBe(200)
}
async function login(context: BrowserContext, account: Account) {
  await context.addInitScript((token) => sessionStorage.setItem('cdocs_token', token), account.token)
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort())
}
async function open(page: Page, account: Account) {
  await login(page.context(), account)
  await page.goto(`/markdown/${id}`)
  await expect(page.locator('.cm-content')).toBeVisible()
}
test.beforeEach(async ({ request }) => {
  const users = await Promise.all(['owner', 'guest', 'outsider'].map(async (name) => {
    const response = await request.post('/api/auth/register', { data: { username: `${name}-${Date.now()}`, password: 'test-pass-123' } })
    expect(response.status()).toBe(201)
    return response.json() as Promise<Account>
  }))
  ;[owner, guest, outsider] = users
  const response = await request.post('/api/documents', { headers: headers(owner), data: { name: 'Shared Markdown', editorType: 'markdown', markdown: '# Review\n\n正文独有关键词', tags: ['team-share'] } })
  expect(response.status()).toBe(201)
  id = (await response.json()).id
})

test('owner invites in ShareModal, gets a Markdown link and handles invitation errors', async ({ page }) => {
  await open(page, owner)
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Share document' })
  await expect(modal.getByRole('textbox', { name: 'Document share link' })).toHaveValue(`http://127.0.0.1:3018/markdown/${id}`)
  await expect(modal.getByRole('combobox', { name: 'Invitation role' }).locator('option')).toHaveCount(3)
  await modal.getByRole('textbox', { name: 'Username to invite' }).fill('unknown-user')
  await modal.getByRole('button', { name: 'Invite', exact: true }).click()
  await expect(modal.getByRole('alert')).toHaveText('User not found')
  await modal.getByRole('textbox', { name: 'Username to invite' }).fill(guest.user.username)
  await modal.getByRole('combobox').selectOption('reader')
  await modal.getByRole('button', { name: 'Invite', exact: true }).click()
  await expect(modal.locator('.access-item').filter({ hasText: guest.user.username })).toContainText('Reader')
  await expect(modal.getByRole('alert')).toHaveCount(0)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await modal.getByRole('button', { name: 'Copy link', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://127.0.0.1:3018/markdown/${id}`)
})

test('reader sees Shared with me, searches content/tags and cannot edit using keyboard or metadata', async ({ page, request }, testInfo) => {
  await invite(request, 'reader')
  await login(page.context(), guest)
  await page.goto('/markdown')
  const shared = page.getByRole('region', { name: 'Shared Markdown documents' })
  await expect(shared.getByRole('article', { name: 'Open document: Shared Markdown' })).toBeVisible()
  await expect(shared.getByRole('button', { name: /Delete/ })).toHaveCount(0)
  const search = page.getByRole('searchbox', { name: 'Search Markdown' })
  await search.fill('正文独有关键词')
  await expect(page.getByRole('heading', { name: /Search results/ })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.locator('.doc-card-snippet')).toContainText('正文独有关键词')
  await search.press('Escape')
  await page.getByRole('button', { name: /team-share/ }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await page.getByRole('article').click()
  await expect(page.locator('.markdown-save-bar').getByRole('status')).toHaveText('Read only')
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeDisabled()
  await expect(page.getByRole('textbox', { name: 'Add tag' })).toHaveCount(0)
  await expect(page.locator('.cm-content')).toHaveAttribute('contenteditable', 'false')
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+b')
  await page.keyboard.press('Control+i')
  await page.keyboard.type('forbidden')
  await expect(page.locator('.cm-content')).not.toContainText('forbidden')
  await expect(page.locator('.cm-content')).not.toContainText('**')
  expect((await (await request.get(uri('/markdown'), { headers: headers(guest) })).json()).markdown).toBe('# Review\n\n正文独有关键词')
  await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true })
})

test('editor saves source/title/tags and concurrent owner changes cause a recoverable conflict', async ({ page, request }) => {
  await invite(request, 'editor')
  await open(page, guest)
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0)
  const source = page.locator('.cm-content')
  await source.fill('# Editor saved\n\nshared content')
  await expect.poll(async () => (await (await request.get(uri('/markdown'), { headers: headers(owner) })).json()).revision).toBe(1)
  let releaseTitle!: () => void
  const titleGate = new Promise<void>((resolve) => { releaseTitle = resolve })
  await page.route('**/metadata', async (route) => {
    if (route.request().method() === 'PATCH' && route.request().postDataJSON()?.title) await titleGate
    await route.continue()
  })
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Edited shared title')
  await page.getByRole('textbox', { name: 'Add tag' }).fill('editor-tag')
  await page.getByRole('textbox', { name: 'Add tag' }).press('Enter')
  releaseTitle()
  await expect.poll(async () => (await (await request.get(uri('/metadata'), { headers: headers(owner) })).json()).tags).toContain('editor-tag')
  expect((await (await request.get(uri('/metadata'), { headers: headers(owner) })).json()).name).toBe('Edited shared title')
  const changed = await request.put(uri('/markdown'), { headers: headers(owner), data: { markdown: '# Owner concurrent', baseRevision: 1 } })
  expect(changed.status()).toBe(200)
  await source.fill('# Stale editor source')
  await expect(page.getByRole('dialog', { name: 'Save conflict' })).toBeVisible()
  await page.getByRole('button', { name: 'Load latest', exact: true }).click()
  await expect(source).toContainText('Owner concurrent')
  await invite(request, 'reader')
  await page.reload()
  await expect(source).toHaveAttribute('contenteditable', 'false')
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeDisabled()
})

test('owner revokes via UI; former recipient loses listings/search/tags/suggestions and direct URL access', async ({ page, browser, request }) => {
  await invite(request, 'reader')
  const recipient = await browser.newContext()
  try {
    await login(recipient, guest)
    const other = await recipient.newPage()
    await other.goto(`/markdown/${id}`)
    await expect(other.locator('.cm-content')).toBeVisible()
    await open(page, owner)
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    page.on('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: `Remove ${guest.user.username}`, exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Share document' }).locator('.access-item')).toHaveCount(1)
    await expect(other).toHaveURL(new RegExp('/markdown$'))
    await other.goto(`/markdown/${id}`)
    await expect(other.getByRole('heading', { name: 'Unable to open document' })).toBeVisible()
    await other.goto('/markdown')
    await expect(other.getByRole('article')).toHaveCount(0)
    for (const path of ['/api/documents?type=markdown', '/api/search?q=正文', '/api/tags', '/api/documents/suggest?q=Shared']) {
      const response = await request.get(path, { headers: headers(guest) })
      expect(response.status()).toBe(200)
      expect(await response.json()).toEqual([])
    }
    await login(recipient, outsider)
    await other.goto(`/markdown/${id}`)
    await expect(other.getByRole('heading', { name: 'Unable to open document' })).toBeVisible()
  } finally { await recipient.close() }
})


test('sharing alone keeps Markdown Yjs rooms closed for owner and invited editor', async ({ request }) => {
  await invite(request, 'editor')
  for (const [account, expected] of [[owner, 403], [guest, 403], [outsider, 404]] as const) {
    const status = await new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:3018/yjs/${id}?token=${account.token}`)
      const timeout = setTimeout(() => { socket.terminate(); reject(new Error('Upgrade response timed out')) }, 5000)
      socket.on('unexpected-response', (_req: unknown, response: { statusCode: number; resume: () => void }) => {
        clearTimeout(timeout); response.resume(); socket.terminate(); resolve(response.statusCode)
      })
      socket.on('open', () => { clearTimeout(timeout); socket.close(); reject(new Error('Markdown room unexpectedly opened')) })
      socket.on('error', () => { /* unexpected-response is asserted above; timeout catches other errors */ })
    })
    expect(status).toBe(expected)
  }
})
