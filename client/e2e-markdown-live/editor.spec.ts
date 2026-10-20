import { test, expect, type APIRequestContext } from '@playwright/test'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const requireServer = createRequire(path.resolve(process.cwd(), '../server/package.json'))
const { MongoClient } = requireServer('mongodb')
let mongo: InstanceType<typeof MongoClient>
let db: ReturnType<InstanceType<typeof MongoClient>['db']>
let token: string
let userId: string
const headers = () => ({ Authorization: `Bearer ${token}` })
const draftKey = (id: string) => `md_draft:${userId}:${id}`

async function create(request: APIRequestContext, markdown = '# Initial', name = 'Editor test') {
  const res = await request.post('/api/documents', { headers: headers(), data: { editorType: 'markdown', name, markdown } })
  expect(res.status()).toBe(201)
  return (await res.json()).id as string
}

test.beforeAll(async () => {
  const runtime = JSON.parse(await readFile('../server/test-results/markdown-live-runtime.json', 'utf8'))
  expect(runtime.dbName).toBe('e2e_markdown_isolated')
  mongo = new MongoClient(runtime.uri); await mongo.connect(); db = mongo.db(runtime.dbName)
})
test.afterAll(async () => { await mongo?.close() })
test.beforeEach(async ({ page, request }) => {
  const res = await request.post('/api/auth/register', { data: { username: `editor-${Date.now()}`, password: 'test-pass-123' } })
  const auth = await res.json(); token = auth.token; userId = auth.user.id
  await page.addInitScript((value) => sessionStorage.setItem('cdocs_token', value), token)
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort())
})

test('edits real source, renders GFM and persists exact content across a reload', async ({ page, request }, testInfo) => {
  const id = await create(request)
  await page.goto(`/markdown/${id}`)
  const source = page.getByRole('textbox', { name: 'Markdown source' })
  await expect(source).toContainText('# Initial')
  const markdown = '# 中文笔记\n\n**重点**\n\n| 项目 | 状态 |\n| --- | --- |\n| 编辑器 | 完成 |\n\n- [x] 已完成\n- [ ] 下一步\n\n```js\nconst value = 42\n```\n'
  await source.fill(markdown)
  const preview = page.getByRole('region', { name: 'Markdown preview' })
  await expect(preview.getByRole('heading', { name: '中文笔记' })).toBeVisible()
  await expect(preview.getByRole('table')).toContainText('编辑器')
  await expect(preview.getByRole('checkbox').first()).toBeChecked()
  await expect(page.getByRole('status')).toHaveText('Saved')
  await expect.poll(async () => (await db.collection('documents').findOne({ docId: id })).markdown).toBe(markdown)
  await page.screenshot({ path: testInfo.outputPath('markdown-editor-desktop.png'), fullPage: true, animations: 'disabled' })
  await page.reload()
  await expect(source).toContainText('# 中文笔记')
  await expect(preview.getByRole('table')).toContainText('完成')
  expect((await db.collection('documents').findOne({ docId: id })).revision).toBe(1)
})

test('supports Ctrl+S and CodeMirror undo without remounting the editor', async ({ page, request }) => {
  const id = await create(request, '')
  await page.goto(`/markdown/${id}`)
  const source = page.getByRole('textbox', { name: 'Markdown source' })
  await source.fill('Manual save')
  await source.press('Control+s')
  await expect(page.getByRole('status')).toHaveText('Saved')
  await expect.poll(async () => (await db.collection('documents').findOne({ docId: id })).markdown).toBe('Manual save')
  await source.press('Control+z')
  await expect.poll(async () => (await db.collection('documents').findOne({ docId: id })).markdown).toBe('')
  await expect(source).toHaveAttribute('contenteditable', 'true')
})

test('recovers an offline draft after a real reload and then saves it', async ({ page, request }) => {
  const id = await create(request)
  // A small document may successfully flush via keepalive while the old page unloads.
  // Large documents deliberately use local recovery instead of an unload request.
  const markdown = '# 离线草稿\n\n不能丢失的内容\n' + '长'.repeat(20_000)
  await page.route(`**/api/documents/${id}/markdown`, (route) => route.request().method() === 'PUT' ? route.abort('failed') : route.continue())
  await page.goto(`/markdown/${id}`)
  await page.getByRole('textbox', { name: 'Markdown source' }).fill(markdown)
  await expect(page.getByRole('status')).toContainText('Offline')
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey(id))).toContain('不能丢失')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Unsaved draft found' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toHaveAttribute('contenteditable', 'false')
  await page.unroute(`**/api/documents/${id}/markdown`)
  await page.getByRole('button', { name: 'Recover draft' }).click()
  await expect.poll(async () => (await db.collection('documents').findOne({ docId: id })).markdown).toBe(markdown)
  await expect(page.getByRole('status')).toHaveText('Saved')
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey(id))).toBeNull()
})

test('allows explicitly discarding a local draft without modifying the server', async ({ page, request }) => {
  const id = await create(request)
  await page.goto(`/markdown/${id}`)
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toBeVisible()
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ markdown: 'Discard this', revision: 0, savedAt: Date.now() })), draftKey(id))
  await page.reload()
  await page.getByRole('button', { name: 'Use server version' }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toContainText('# Initial')
  expect((await db.collection('documents').findOne({ docId: id })).revision).toBe(0)
})

test('detects conflicts between two real tabs and requires an explicit overwrite', async ({ page, context, request }) => {
  const id = await create(request)
  const other = await context.newPage()
  try {
    await other.addInitScript((value) => sessionStorage.setItem('cdocs_token', value), token)
    await other.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort())
    await page.goto(`/markdown/${id}`); await other.goto(`/markdown/${id}`)
    await expect(other.getByRole('textbox', { name: 'Markdown source' })).toContainText('# Initial')
    await page.getByRole('textbox', { name: 'Markdown source' }).fill('First writer')
    await expect.poll(async () => (await db.collection('documents').findOne({ docId: id })).revision).toBe(1)
    await other.getByRole('textbox', { name: 'Markdown source' }).fill('Second writer')
    const dialog = other.getByRole('dialog', { name: 'Save conflict' })
    await expect(dialog).toBeVisible()
    expect((await db.collection('documents').findOne({ docId: id })).markdown).toBe('First writer')
    await other.keyboard.press('Escape')
    await expect(other.getByRole('textbox', { name: 'Markdown source' })).toContainText('Second writer')
    await other.getByRole('button', { name: 'Resolve conflict' }).click()
    await dialog.getByRole('button', { name: 'Keep mine and overwrite' }).click()
    await expect(other.getByRole('status')).toHaveText('Saved')
    expect((await db.collection('documents').findOne({ docId: id })).markdown).toBe('Second writer')
    expect((await db.collection('documents').findOne({ docId: id })).revision).toBe(2)
  } finally { await other.close() }
})

test('loads the latest source on conflict without issuing another write', async ({ page, request }) => {
  const id = await create(request)
  await page.goto(`/markdown/${id}`)
  const source = page.getByRole('textbox', { name: 'Markdown source' })
  await expect(source).toBeVisible()
  await request.put(`/api/documents/${id}/markdown`, { headers: headers(), data: { markdown: '# 最新版本', baseRevision: 0 } })
  await source.fill('My rejected draft')
  const dialog = page.getByRole('dialog', { name: 'Save conflict' })
  await dialog.getByRole('button', { name: 'Load latest' }).click()
  await expect(source).toContainText('# 最新版本')
  await expect(page.getByRole('status')).toHaveText('Saved')
  expect((await db.collection('documents').findOne({ docId: id })).revision).toBe(1)
})

test('does not save a Chinese IME composition before it is committed', async ({ page, context, request }) => {
  const id = await create(request, '')
  await page.goto(`/markdown/${id}`)
  const source = page.getByRole('textbox', { name: 'Markdown source' })
  await source.click()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.imeSetComposition', { text: 'zhong', selectionStart: 5, selectionEnd: 5 })
  await page.waitForTimeout(1000)
  expect((await db.collection('documents').findOne({ docId: id })).revision).toBe(0)
  await cdp.send('Input.insertText', { text: '中文' })
  await expect.poll(async () => (await db.collection('documents').findOne({ docId: id })).markdown).toBe('中文')
  await expect(source).toContainText('中文')
  await cdp.detach()
})

test('flushes unsaved small source when navigating back to the home page', async ({ page, request }) => {
  const id = await create(request)
  await page.goto(`/markdown/${id}`)
  await page.getByRole('textbox', { name: 'Markdown source' }).fill('Save on leave')
  await page.getByRole('link', { name: 'Back to Markdown documents' }).click()
  await expect(page).toHaveURL(/\/markdown$/)
  await expect.poll(async () => (await db.collection('documents').findOne({ docId: id })).markdown).toBe('Save on leave')
})

test('loads and edits a 5000-line document using the virtualized source view', async ({ page, request }) => {
  const markdown = '# Large\n\n' + Array.from({ length: 5000 }, (_, index) => `- Row ${index}`).join('\n')
  const id = await create(request, markdown)
  await page.goto(`/markdown/${id}`)
  const source = page.getByRole('textbox', { name: 'Markdown source' })
  await expect(source).toContainText('# Large')
  expect(await page.locator('.cm-line').count()).toBeLessThan(5000)
  await source.click(); await source.press('Control+End'); await page.keyboard.insertText('\n最后新增')
  await expect.poll(async () => (await db.collection('documents').findOne({ docId: id })).markdown.endsWith('最后新增')).toBe(true)
})

test('opens resolved wiki links and safely renders unsafe raw HTML as inert content', async ({ page, request }) => {
  const target = await create(request, '# Target body', '目标笔记')
  const id = await create(request, '[[目标笔记|阅读目标]] [[Missing]]\n\n<script>window.__previewAttack=1</script>\n\n<img src=x onerror="window.__previewAttack=1">')
  await page.goto(`/markdown/${id}`)
  const preview = page.getByRole('region', { name: 'Markdown preview' })
  await expect(preview.getByRole('link', { name: '阅读目标' })).toHaveAttribute('href', `/markdown/${target}`)
  await expect(preview.locator('script,img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__previewAttack)).toBeUndefined()
  await preview.getByRole('link', { name: '阅读目标' }).click()
  await expect(page).toHaveURL(new RegExp(`/markdown/${target}$`))
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toContainText('# Target body')
})

test('retries a failed source load without mounting an empty editable document', async ({ page, request }) => {
  const id = await create(request)
  let fail = true
  await page.route(`**/api/documents/${id}/markdown`, async (route) => {
    if (fail && route.request().method() === 'GET') { fail = false; await route.fulfill({ status: 503, json: { error: 'Temporary outage' } }) }
    else await route.continue()
  })
  await page.goto(`/markdown/${id}`)
  await expect(page.getByRole('heading', { name: 'Unable to load Markdown' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toContainText('# Initial')
})

test('keeps source and preview usable at 375px', async ({ page, request }, testInfo) => {
  const id = await create(request, '# 手机笔记\n\n- [ ] 移动端测试')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`/markdown/${id}`)
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Markdown preview' })).toContainText('手机笔记')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('markdown-editor-mobile.png'), fullPage: true, animations: 'disabled' })
})
