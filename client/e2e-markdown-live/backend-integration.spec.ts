import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { markdownTemplates } from '../src/templates/markdown'

const requireServer = createRequire(path.resolve(process.cwd(), '../server/package.json'))
const { MongoClient, ObjectId } = requireServer('mongodb')
const WebSocket = requireServer('ws')
let mongo: InstanceType<typeof MongoClient>
let db: ReturnType<InstanceType<typeof MongoClient>['db']>
let token: string
let userId: string

test.beforeAll(async () => {
  const runtime = JSON.parse(await readFile('../server/test-results/markdown-live-runtime.json', 'utf8'))
  expect(runtime.dbName).toBe('e2e_markdown_isolated')
  mongo = new MongoClient(runtime.uri)
  await mongo.connect()
  db = mongo.db(runtime.dbName)
})

test.afterAll(async () => { await mongo?.close() })

test.beforeEach(async ({ page, request }) => {
  const response = await request.post('/api/auth/register', { data: { username: `live-${Date.now()}`, password: 'test-pass-123' } })
  expect(response.status()).toBe(201)
  const auth = await response.json()
  token = auth.token
  userId = auth.user.id
  await page.addInitScript((value) => sessionStorage.setItem('cdocs_token', value), token)
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort())
})

test('creates all seven templates through the real UI and verifies persisted source in MongoDB', async ({ page, request }) => {
  for (const template of markdownTemplates) {
    await page.goto('/markdown')
    await page.getByRole('button', { name: 'New document', exact: true }).click()
    const picker = page.getByRole('dialog', { name: 'Choose a Markdown template' })
    await picker.getByRole('button', { name: new RegExp(`^${template.name}`) }).click()
    const nameInput = page.getByRole('textbox', { name: 'Document name' })
    await expect(nameInput).toBeFocused()
    await expect(nameInput).toHaveValue('')
    await expect(nameInput).toHaveAttribute('placeholder', template.category === 'blank' ? 'Untitled document' : template.name)
    expect(await nameInput.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd])).toEqual([0, 0])
    await page.keyboard.insertText(`真实测试 ${template.name}`)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(/\/markdown\/[^/]+$/)
    await expect(page.getByRole('heading', { name: `真实测试 ${template.name}`, exact: true })).toBeVisible()
    const id = decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!)
    const doc = await db.collection('documents').findOne({ docId: id })
    expect(doc).toMatchObject({ editorType: 'markdown', markdown: template.markdown, revision: 0, tags: [], crdtStateSize: 0 })
    expect(doc.ownerUserId.toHexString()).toBe(userId)
    expect(doc.crdtState.buffer.length).toBe(0)
    const meta = await request.get(`/api/documents/${id}/metadata`, { headers: { Authorization: `Bearer ${token}` } })
    expect(meta.status()).toBe(200)
    expect(await meta.json()).toMatchObject({ editorType: 'markdown', revision: 0, abilities: { canShare: false } })
  }
  await page.goto('/markdown')
  await expect(page.getByRole('article')).toHaveCount(7)
  await page.reload()
  await expect(page.getByRole('article')).toHaveCount(7)
})

test('shows gray template placeholders, accepts direct typing and creates with the template name when left empty', async ({ page }, testInfo) => {
  await page.goto('/markdown')
  await page.getByRole('button', { name: 'Business', exact: true }).click()
  await page.getByRole('button', { name: 'Meeting Notes', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Document name' })
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('')
  await expect(input).toHaveAttribute('placeholder', 'Meeting Notes')
  expect(await input.evaluate((node) => getComputedStyle(node, '::placeholder').color)).toBe('rgb(128, 134, 139)')
  await page.getByRole('dialog', { name: 'Name your document' }).locator('.modal').screenshot({ path: testInfo.outputPath('gray-template-placeholder.png'), animations: 'disabled' })
  await page.keyboard.insertText('直接输入的新名称')
  await expect(input).toHaveValue('直接输入的新名称')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page).toHaveURL(/\/markdown\/[^/]+$/)
  await expect(page.getByRole('banner').getByRole('heading', { name: '直接输入的新名称', exact: true })).toBeVisible()
  await page.goto('/markdown')
  await page.getByRole('button', { name: 'Business', exact: true }).click()
  await page.getByRole('button', { name: 'Meeting Notes', exact: true }).click()
  await expect(input).toHaveValue('')
  await input.press('Enter')
  await expect(page).toHaveURL(/\/markdown\/[^/]+$/)
  await expect(page.getByRole('banner').getByRole('heading', { name: 'Meeting Notes', exact: true })).toBeVisible()
  const id = decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!)
  expect((await db.collection('documents').findOne({ docId: id })).title).toBe('Meeting Notes')
})

test('separates Markdown, rich and legacy documents after a real reload and workspace switch', async ({ page, request }) => {
  const headers = { Authorization: `Bearer ${token}` }
  await request.post('/api/documents', { headers, data: { name: 'Only Markdown', editorType: 'markdown', markdown: '# Keep' } })
  await request.post('/api/documents', { headers, data: { name: 'Only Rich' } })
  await db.collection('documents').insertOne({
    docId: 'legacy-live', title: 'Old Rich', ownerUserId: new ObjectId(userId),
    crdtState: Buffer.alloc(0), crdtStateSize: 0, updateCount: 0, createdAt: new Date(), updatedAt: new Date(),
  })
  await page.goto('/markdown')
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article', { name: 'Open document: Only Markdown' })).toBeVisible()
  await page.getByRole('button', { name: 'Open app menu' }).click()
  await page.getByRole('menuitemradio', { name: 'Docs', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByRole('article', { name: 'Open document: Only Rich' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Open document: Old Rich' })).toBeVisible()
})

test('persists confirmed deletion and keeps the source intact in the soft-deleted record', async ({ page, request }) => {
  const created = await request.post('/api/documents', { headers: { Authorization: `Bearer ${token}` }, data: { name: 'Remove me', editorType: 'markdown', markdown: '# Preserve' } })
  const { id } = await created.json()
  await page.goto('/markdown')
  await page.getByRole('button', { name: 'Delete Remove me' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No documents yet' })).toBeVisible()
  const doc = await db.collection('documents').findOne({ docId: id })
  expect(doc.deletedAt).toBeInstanceOf(Date)
  expect(doc.markdown).toBe('# Preserve')
})

test('rejects another account even with an old admin invitation', async ({ request }) => {
  const headers = { Authorization: `Bearer ${token}` }
  const created = await request.post('/api/documents', { headers, data: { name: 'Private', editorType: 'markdown' } })
  const { id } = await created.json()
  const response = await request.post('/api/auth/register', { data: { username: `outsider-${Date.now()}`, password: 'test-pass-123' } })
  const other = await response.json()
  const doc = await db.collection('documents').findOne({ docId: id })
  await db.collection('document_access').insertOne({ documentId: doc._id, userId: new ObjectId(other.user.id), role: 'administrator', invitedAt: new Date(), acceptedAt: new Date() })
  const foreignHeaders = { Authorization: `Bearer ${other.token}` }
  expect((await request.get(`/api/documents/${id}/metadata`, { headers: foreignHeaders })).status()).toBe(404)
  expect(await (await request.get('/api/documents?type=all', { headers: foreignHeaders })).json()).toEqual([])
  expect((await request.delete(`/api/documents/${id}`, { headers: foreignHeaders })).status()).toBe(404)
})

function upgradeStatus(id: string, authToken: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:3018/yjs/${id}?token=${encodeURIComponent(authToken)}`)
    ws.once('unexpected-response', (_request: unknown, response: { statusCode: number; resume(): void }) => {
      response.resume()
      resolve(response.statusCode)
      ws.terminate()
    })
    ws.once('open', () => { resolve(101); ws.close() })
    ws.once('error', reject)
  })
}

test('blocks Markdown Yjs upgrades while rich collaboration still connects', async ({ request }) => {
  const headers = { Authorization: `Bearer ${token}` }
  const md = await (await request.post('/api/documents', { headers, data: { editorType: 'markdown' } })).json()
  const rich = await (await request.post('/api/documents', { headers, data: { name: 'Rich sync' } })).json()
  expect(await upgradeStatus(md.id, token)).toBe(403)
  expect(await upgradeStatus(rich.id, token)).toBe(101)
  const doc = await db.collection('documents').findOne({ docId: md.id })
  expect(doc.crdtState.buffer.length).toBe(0)
})
