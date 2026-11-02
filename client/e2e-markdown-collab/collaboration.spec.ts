import { test, expect, type Page, type BrowserContext, type APIRequestContext, type Browser } from '@playwright/test'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
const requireServer = createRequire(path.resolve('../server/package.json'))
const { MongoClient } = requireServer('mongodb')
const Y = requireServer('yjs'), WS = requireServer('ws')
const encoding = requireServer('lib0/encoding'), decoding = requireServer('lib0/decoding'), sync = requireServer('y-protocols/sync')
type Account = { token: string; user: { id: string; username: string } }
let owner: Account, editor: Account, reader: Account, id: string
let runtime: { uri: string; dbName: string; controlToken: string }
let mongo: InstanceType<typeof MongoClient>, db: ReturnType<InstanceType<typeof MongoClient>['db']>
const contexts: BrowserContext[] = []
const headers = (account = owner) => ({ Authorization: `Bearer ${account.token}` })
const endpoint = (suffix: string) => `/api/documents/${id}${suffix}`
async function content(request: APIRequestContext, account = owner) {
  const response = await request.get(endpoint('/markdown'), { headers: headers(account) })
  expect(response.status()).toBe(200); return response.json()
}
async function restart(request: APIRequestContext, sharing = true, collab = true) {
  expect((await request.post('http://127.0.0.1:3019/restart', { headers: { 'x-test-control': runtime.controlToken }, data: { sharing, collab } })).status()).toBe(200)
}
async function share(request: APIRequestContext, account: Account, role: string) {
  expect((await request.post(endpoint('/share'), { headers: headers(), data: { username: account.user.username, role } })).status()).toBe(200)
}
async function signedIn(context: BrowserContext, account: Account) {
  await context.addInitScript((token) => sessionStorage.setItem('cdocs_token', token), account.token)
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await context.route('https://fonts.gstatic.com/**', (route) => route.abort())
}
async function open(page: Page, account: Account) {
  await signedIn(page.context(), account); await page.goto(`/markdown/${id}`)
  await expect(page.locator('.cm-content')).toBeVisible()
  await expect(page.getByRole('status', { name: 'Collaboration connection' })).toHaveText('Connected')
}
async function append(page: Page, text: string) {
  await page.bringToFront()
  await page.locator('.cm-content').press('Control+End')
  await page.locator('.cm-content').pressSequentially(text)
}
async function second(browser: Browser, account: Account) {
  const context = await browser.newContext(); contexts.push(context)
  const page = await context.newPage(); await open(page, account); return page
}
test.beforeAll(async () => {
  runtime = JSON.parse(await readFile('../server/test-results/markdown-live-runtime.json', 'utf8'))
  expect(runtime.dbName).toBe('e2e_markdown_isolated')
  mongo = new MongoClient(runtime.uri); await mongo.connect(); db = mongo.db(runtime.dbName)
})
test.afterAll(async () => { await mongo?.close() })
test.beforeEach(async ({ request }) => {
  await restart(request)
  ;[owner, editor, reader] = await Promise.all(['owner', 'editor', 'reader'].map(async (prefix) => {
    const response = await request.post('/api/auth/register', { data: { username: `${prefix}-${Date.now()}`, password: 'test-pass-123' } })
    expect(response.status()).toBe(201); return response.json()
  }))
  const response = await request.post('/api/documents', { headers: headers(), data: { name: 'Legacy collaboration note', editorType: 'markdown', markdown: '# Legacy\n\nOriginal body.\n', tags: ['keep-tag'] } })
  expect(response.status()).toBe(201); id = (await response.json()).id
  await share(request, editor, 'editor'); await share(request, reader, 'reader')
})
test.afterEach(async () => { await Promise.all(contexts.splice(0).map((context) => context.close())) })

test('concurrent first opens and reloads seed legacy content exactly once', async ({ page, browser, request }) => {
  const before = await db.collection('documents').findOne({ docId: id }); expect(before.crdtStateSize).toBe(0)
  const context = await browser.newContext(); contexts.push(context); const other = await context.newPage()
  await Promise.all([open(page, owner), open(other, editor)])
  await expect(other.locator('.cm-content')).toContainText('Original body.')
  await Promise.all([page.reload(), other.reload()]); await expect(page.locator('.cm-content')).toBeVisible()
  expect((await page.locator('.cm-content').innerText()).split('Original body.').length - 1).toBe(1)
  const stored = await db.collection('documents').findOne({ docId: id })
  expect(stored.crdtStateSize).toBeGreaterThan(0); expect(stored.title).toBe(before.title)
  expect(stored.tags).toEqual(['keep-tag']); expect(stored.ownerUserId.toString()).toBe(owner.user.id)
  expect((await content(request)).markdown).toBe(before.markdown)
})
test('concurrent edits converge, undo preserves the other writer and deletion saves without REST', async ({ page, browser, request }) => {
  await open(page, owner); const other = await second(browser, editor)
  const puts: string[] = []
  for (const target of [page, other]) target.on('request', (req) => { if (req.method() === 'PUT' && req.url().endsWith('/markdown')) puts.push(req.url()) })
  await Promise.all([page.context().setOffline(true), other.context().setOffline(true)])
  await append(page, 'OWNER-A'); await append(other, 'EDITOR-B')
  await Promise.all([page.context().setOffline(false), other.context().setOffline(false)])
  for (const target of [page, other]) { await expect(target.locator('.cm-content')).toContainText('OWNER-A'); await expect(target.locator('.cm-content')).toContainText('EDITOR-B') }
  await page.bringToFront(); await page.locator('.cm-content').press('Control+z')
  await expect(other.locator('.cm-content')).not.toContainText('OWNER-A'); await expect(other.locator('.cm-content')).toContainText('EDITOR-B')
  await page.locator('.cm-content').press('Control+Shift+z'); await expect(other.locator('.cm-content')).toContainText('OWNER-A')
  await page.locator('.cm-content').fill('')
  await expect.poll(async () => (await content(request)).markdown).toBe('')
  await expect.poll(() => other.locator('.cm-content').evaluate((node) => { const copy = node.cloneNode(true) as HTMLElement; copy.querySelectorAll('.cm-ySelectionCaret').forEach((item) => item.remove()); return copy.textContent?.replace(/[\u2060\u200b]/g, '').trim() })).toBe('')
  await expect(page.locator('.markdown-save-bar').getByRole('status').first()).toHaveText('Saved')
  expect(puts).toEqual([])
  expect((await request.put(endpoint('/markdown'), { headers: headers(), data: { markdown: 'REST forbidden', baseRevision: 0 } })).status()).toBe(409)
})
test('presence, remote cursors and reader live preview work together', async ({ page, browser }, testInfo) => {
  await open(page, owner); const other = await second(browser, editor); const view = await second(browser, reader)
  await expect(page.getByLabel('Online collaborators')).toContainText(editor.user.username)
  await expect(page.getByLabel('Online collaborators')).toContainText(reader.user.username)
  await other.locator('.cm-content').click(); await other.keyboard.press('Control+a')
  await expect(page.locator('.cm-ySelection').first()).toBeVisible(); await expect(page.locator('.cm-ySelectionCaret').first()).toBeVisible()
  await expect(view.locator('.cm-content')).toHaveAttribute('contenteditable', 'false')
  await append(page, 'LIVE-FOR-READER'); await expect(view.locator('.cm-content')).toContainText('LIVE-FOR-READER')
  await view.locator('.cm-content').click(); await view.keyboard.press('Control+b'); await view.keyboard.type('FORBIDDEN')
  await expect(view.locator('.cm-content')).not.toContainText('FORBIDDEN')
  await page.screenshot({ path: testInfo.outputPath('presence-cursors.png'), fullPage: true })
})
test('reader-forged sync step2 and update packets cannot mutate the server', async ({ request }) => {
  const initial = await content(request, reader)
  const forged = new Y.Doc(); Y.applyUpdate(forged, Buffer.from(initial.crdtState, 'base64')); forged.getText('markdown').insert(0, 'READER-ATTACK')
  await new Promise<void>((resolve, reject) => {
    const socket = new WS(`ws://127.0.0.1:3018/yjs/${id}?token=${reader.token}`)
    const timer = setTimeout(() => { socket.terminate(); reject(new Error('No acknowledgement')) }, 10000)
    socket.on('open', () => {
      for (const kind of [1, 2]) {
        const message = encoding.createEncoder(); encoding.writeVarUint(message, 0)
        if (kind === 1) sync.writeSyncStep2(message, forged); else sync.writeUpdate(message, Y.encodeStateAsUpdate(forged))
        socket.send(encoding.toUint8Array(message))
      }
      const flush = encoding.createEncoder(); encoding.writeVarUint(flush, 4); socket.send(encoding.toUint8Array(flush))
    })
    socket.on('message', (raw: Buffer) => { if (decoding.readVarUint(decoding.createDecoder(new Uint8Array(raw))) === 4) { clearTimeout(timer); socket.close(); resolve() } })
    socket.on('error', reject)
  })
  forged.destroy(); expect((await content(request)).markdown).not.toContain('READER-ATTACK')
})
test('offline edits survive page close and merge with remote edits on reconnect', async ({ page, browser, request }) => {
  await open(page, owner); const other = await second(browser, editor); const context = other.context()
  await context.setOffline(true); await expect(other.getByRole('status', { name: 'Collaboration connection' })).toContainText('Offline')
  await append(other, 'OFFLINE-EDITOR'); await append(page, 'ONLINE-OWNER')
  await expect.poll(async () => (await content(request)).markdown).toContain('ONLINE-OWNER')
  await expect.poll(async () => other.evaluate(async () => (await indexedDB.databases()).filter((entry) => entry.name?.startsWith('markdown:')).length)).toBeGreaterThan(0)
  await other.close(); await context.setOffline(false)
  const restored = await context.newPage(); await restored.goto(`/markdown/${id}`)
  await expect(restored.locator('.cm-content')).toContainText('OFFLINE-EDITOR'); await expect(restored.locator('.cm-content')).toContainText('ONLINE-OWNER')
  await expect(page.locator('.cm-content')).toContainText('OFFLINE-EDITOR')
  await expect.poll(async () => (await content(request)).markdown).toContain('OFFLINE-EDITOR')
  expect((await content(request)).markdown.split('Original body.').length - 1).toBe(1)
})
test('role changes, revocation and invitations update open pages automatically', async ({ page, browser, request }) => {
  const other = await second(browser, editor)
  await share(request, editor, 'reader'); await expect(other.locator('.cm-content')).toHaveAttribute('contenteditable', 'false')
  await share(request, editor, 'editor'); await expect(other.locator('.cm-content')).toHaveAttribute('contenteditable', 'true')
  await open(page, owner); await page.getByRole('button', { name: 'Share', exact: true }).click()
  page.on('dialog', (dialog) => dialog.accept()); await page.getByRole('button', { name: `Remove ${editor.user.username}` }).click()
  await expect(other).toHaveURL(new RegExp('/markdown$')); await expect(other.getByRole('status').filter({ hasText: 'Access to this document was removed' })).toBeVisible()
  await expect(other.getByRole('article')).toHaveCount(0)
  await share(request, editor, 'reader'); await expect(other.getByRole('article')).toHaveCount(1)
})
test('metadata notifications, search mirrors and backlinks follow collaborative writes', async ({ page, browser, request }) => {
  await open(page, owner); const other = await second(browser, editor)
  expect((await request.patch(endpoint('/metadata'), { headers: headers(), data: { title: 'Live title', tags: ['live-tag'] } })).status()).toBe(200)
  await expect(other.getByRole('banner').getByRole('heading', { name: 'Live title' })).toBeVisible(); await expect(other.getByLabel('Tags')).toContainText('live-tag')
  const target = await request.post('/api/documents', { headers: headers(), data: { name: 'Link target', editorType: 'markdown', markdown: '' } }); const targetId = (await target.json()).id
  await page.locator('.cm-content').fill('unique-collab-search [[Link target]]')
  await expect.poll(async () => (await content(request)).markdown).toContain('unique-collab-search')
  expect((await (await request.get('/api/search?q=unique-collab-search', { headers: headers() })).json()).map((doc: { id: string }) => doc.id)).toContain(id)
  expect((await (await request.get(`/api/documents/${targetId}/links`, { headers: headers() })).json()).backlinks.map((doc: { id: string }) => doc.id)).toContain(id)
})
test('graceful restart flushes edits before the debounce and does not reseed', async ({ page, browser, request }) => {
  await open(page, owner); const other = await second(browser, editor)
  await append(page, 'SHUTDOWN-PRESERVED'); await expect(other.locator('.cm-content')).toContainText('SHUTDOWN-PRESERVED')
  await restart(request); await expect(page.getByRole('status', { name: 'Collaboration connection' })).toHaveText('Connected')
  await expect.poll(async () => (await content(request)).markdown).toContain('SHUTDOWN-PRESERVED')
  await page.reload(); await expect(page.locator('.cm-content')).toContainText('SHUTDOWN-PRESERVED')
  expect((await page.locator('.cm-content').innerText()).split('SHUTDOWN-PRESERVED').length - 1).toBe(1)
})
test('rollback preserves source and re-enabling ignores stale offline caches from an older epoch', async ({ page, browser, request }) => {
  await open(page, owner); const other = await second(browser, editor); const context = other.context()
  await append(page, 'BEFORE-ROLLBACK'); await expect.poll(async () => (await content(request)).markdown).toContain('BEFORE-ROLLBACK')
  const epoch = (await content(request)).collaborationEpoch
  await context.setOffline(true); await append(other, 'STALE-OFFLINE-CACHE'); await other.close()
  await restart(request, false, false)
  await expect(page.getByRole('status', { name: 'Collaboration connection' })).toHaveCount(0)
  await expect(page.locator('.cm-content')).toContainText('BEFORE-ROLLBACK'); await append(page, 'REST-ROLLBACK-WRITE')
  await expect.poll(async () => (await content(request)).markdown).toContain('REST-ROLLBACK-WRITE')
  expect((await request.get(endpoint('/markdown'), { headers: headers(editor) })).status()).toBe(404)
  await restart(request); await expect(page.getByRole('status', { name: 'Collaboration connection' })).toHaveText('Connected')
  await context.setOffline(false); const restored = await context.newPage(); await restored.goto(`/markdown/${id}`)
  await expect(restored.locator('.cm-content')).toContainText('REST-ROLLBACK-WRITE'); await expect(restored.locator('.cm-content')).not.toContainText('STALE-OFFLINE-CACHE')
  await expect(restored.getByRole('region', { name: 'Previous offline draft' })).toBeVisible()
  const downloadPromise = restored.waitForEvent('download')
  await restored.getByRole('button', { name: 'Download previous offline draft' }).click()
  const download = await downloadPromise
  expect(await readFile((await download.path())!, 'utf8')).toContain('STALE-OFFLINE-CACHE')
  expect((await content(request)).collaborationEpoch).toBeGreaterThan(epoch)
  expect((await content(request)).markdown.split('Original body.').length - 1).toBe(1)
})


test('a large collaborative document supports narrow stacked panes and committed Chinese input', async ({ page, request, context }) => {
  const large = Array.from({ length: 5000 }, (_, index) => `line ${index}`).join('\n')
  const response = await request.post('/api/documents', { headers: headers(), data: { name: 'Large collab', editorType: 'markdown', markdown: large } })
  id = (await response.json()).id
  await page.setViewportSize({ width: 375, height: 850 }); await open(page, owner)
  const source = page.locator('.markdown-source-pane'), preview = page.locator('.markdown-preview-pane')
  await expect(source).toBeVisible(); await expect(preview).toBeVisible()
  const a = (await source.boundingBox())!, b = (await preview.boundingBox())!
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1)
  await page.bringToFront(); await page.locator('.cm-content').press('Control+End')
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.imeSetComposition', { text: 'zhong', selectionStart: 5, selectionEnd: 5 })
  await cdp.send('Input.insertText', { text: '中文提交' }); await cdp.detach()
  await expect.poll(async () => (await content(request)).markdown, { timeout: 15000 }).toContain('中文提交')
  expect((await content(request)).markdown.split('\n')).toHaveLength(5000)
})

test('a revoked offline editor is rejected on reconnect and its pending updates never reach the document', async ({ page, browser, request }) => {
  await open(page, owner); const other = await second(browser, editor)
  await other.context().setOffline(true); await append(other, 'REVOKED-OFFLINE-UPDATE')
  expect((await request.delete(endpoint(`/access/${editor.user.id}`), { headers: headers() })).status()).toBe(200)
  await other.context().setOffline(false)
  await expect(other).toHaveURL(new RegExp('/markdown$'))
  expect((await content(request)).markdown).not.toContain('REVOKED-OFFLINE-UPDATE')
})


test('the home page rechecks invitations missed while notifications were offline', async ({ browser, request }) => {
  expect((await request.delete(endpoint(`/access/${editor.user.id}`), { headers: headers() })).status()).toBe(200)
  const context = await browser.newContext(); contexts.push(context); await signedIn(context, editor)
  const page = await context.newPage(); await page.goto('/markdown')
  await expect(page.getByRole('article')).toHaveCount(0)
  await context.setOffline(true); await share(request, editor, 'reader')
  await context.setOffline(false)
  await expect(page.getByRole('article', { name: 'Open document: Legacy collaboration note' })).toBeVisible()
})
