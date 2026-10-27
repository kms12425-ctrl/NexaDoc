import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
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

async function create(request: APIRequestContext, markdown = '# Initial', name = 'Export doc') {
  const res = await request.post('/api/documents', { headers: headers(), data: { editorType: 'markdown', name, markdown } })
  expect(res.status()).toBe(201)
  return (await res.json()).id as string
}

test.beforeAll(async () => {
  const runtime = JSON.parse(await readFile('../server/test-results/markdown-live-runtime.json', 'utf8'))
  expect(runtime.dbName).toBe('e2e_markdown_isolated')
  mongo = new MongoClient(runtime.uri)
  await mongo.connect()
  db = mongo.db(runtime.dbName)
})

test.afterAll(async () => { await mongo?.close() })

test.beforeEach(async ({ page, request }) => {
  const res = await request.post('/api/auth/register', { data: { username: `wf-${Date.now()}`, password: 'test-pass-123' } })
  const auth = await res.json(); token = auth.token; userId = auth.user.id
  await page.addInitScript((value) => sessionStorage.setItem('cdocs_token', value), token)
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort())
})

async function openExportMenu(page: Page) {
  await page.getByRole('button', { name: 'Export document' }).click()
  await expect(page.getByRole('menu', { name: 'Export formats' })).toBeVisible()
}

// html2pdf writes each page as a JPEG XObject. Inspect its actual pixels, not
// just the download event/file size (a completely blank PDF can have both).
function pdfPageImages(pdf: Buffer): string[] {
  const images: string[] = []
  let offset = 0
  while ((offset = pdf.indexOf('/Subtype /Image', offset)) !== -1) {
    const stream = pdf.indexOf('\nstream\n', offset)
    expect(stream).toBeGreaterThan(offset)
    const dictionary = pdf.subarray(offset, stream).toString('latin1')
    const length = /\/Length\s+(\d+)/.exec(dictionary)
    expect(length).not.toBeNull()
    const start = stream + '\nstream\n'.length
    if (/\/Filter\s+\/DCTDecode/.test(dictionary)) images.push('data:image/jpeg;base64,' + pdf.subarray(start, start + Number(length![1])).toString('base64'))
    offset = start + Number(length![1])
  }
  return images
}

async function expectNonBlankPdf(page: Page, file: string) {
  const bytes = await readFile(file)
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  const images = pdfPageImages(bytes)
  expect(images.length).toBeGreaterThan(0)
  const darkPixels = await page.evaluate(async (urls) => {
    const counts: number[] = []
    for (const url of urls) {
      const image = new Image(); image.src = url; await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width; canvas.height = image.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(image, 0, 0)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let dark = 0
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 160 && pixels[i + 1] < 160 && pixels[i + 2] < 160) dark++
      counts.push(dark)
    }
    return counts
  }, images)
  for (const count of darkPixels) expect(count, 'each PDF page must contain visible content').toBeGreaterThan(100)
  return images.length
}

test('exports Markdown and HTML using a sanitized filename', async ({ page, request }) => {
  const id = await create(request, '# 导出测试\n\n- 内容', '导出/文档:名称')
  await page.goto(`/markdown/${id}`)
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toContainText('导出测试')

  await openExportMenu(page)
  const mdDownload = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Markdown (.md)' }).click()
  expect((await mdDownload).suggestedFilename()).toBe('导出文档名称.md')

  await openExportMenu(page)
  const htmlDownload = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'HTML (.html)' }).click()
  expect((await htmlDownload).suggestedFilename()).toBe('导出文档名称.html')
})

test('exports PDF with actual visible page content', async ({ page, request }, testInfo) => {
  const id = await create(request, '# PDF 内容\n\n正文段落')
  await page.goto(`/markdown/${id}`)
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toContainText('PDF 内容')

  await openExportMenu(page)
  // html2pdf.js 在前端生成，较慢，给足超时。
  const pdfDownload = page.waitForEvent('download', { timeout: 30000 })
  await page.getByRole('menuitem', { name: 'PDF (.pdf)' }).click()
  const download = await pdfDownload
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
  const output = testInfo.outputPath('markdown-short.pdf')
  await download.saveAs(output)
  await expectNonBlankPdf(page, output)
})

for (const mode of ['source', 'preview'] as const) {
  test(`exports a nonblank PDF in ${mode} layout, preserving latest source and editor styles`, async ({ page, request }, testInfo) => {
    const markdown = '# 中文导出验收 PDF\n\n**加粗**、*斜体*、English 123。\n\n'
      + (mode === 'source' ? Array.from({ length: 40 }, (_, index) => `## 第 ${index + 1} 节\n\n中文正文与 English paragraph ${index + 1}，检查多页正文不丢失。\n\n`).join('') : '')
      + '| 项目 | 状态 |\n| --- | --- |\n| 导出 | 正常 |\n\n```js\nconst message = "中文";\nconsole.log(message);\n```\n\nEND-PDF-CONTENT'
    if (mode === 'preview') await page.setViewportSize({ width: 375, height: 812 })
    const id = await create(request, markdown)
    await page.goto(`/markdown/${id}`)
    const source = page.getByRole('textbox', { name: 'Markdown source' })
    await expect(source).toContainText('中文导出验收')
    // Keep saving offline, but leave lazy-loaded export scripts accessible.
    await page.route(`**/api/documents/${id}/markdown`, (route) => route.request().method() === 'PUT' ? route.abort('failed') : route.continue())
    await source.fill(markdown + '\n\nUNSAVED-PDF-END')
    await expect(page.getByRole('status')).toContainText('Offline')
    expect((await db.collection('documents').findOne({ docId: id })).markdown).toBe(markdown)
    const bodyStyle = () => page.locator('body').evaluate((node) => {
      const style = getComputedStyle(node)
      return { margin: style.margin, maxWidth: style.maxWidth, fontSize: style.fontSize }
    })
    const before = await bodyStyle()
    await page.getByRole('button', { name: mode === 'source' ? 'Source' : 'Preview', exact: true }).click()
    await openExportMenu(page)
    const pending = page.waitForEvent('download', { timeout: 30000 })
    await page.getByRole('menuitem', { name: 'PDF (.pdf)' }).click()
    const download = await pending
    const output = testInfo.outputPath(`markdown-${mode}.pdf`)
    await download.saveAs(output)
    const pages = await expectNonBlankPdf(page, output)
    if (mode === 'source') expect(pages).toBeGreaterThan(1)
    expect(await bodyStyle()).toEqual(before)
    await expect(page.locator('.html2pdf__overlay')).toHaveCount(0)
    await page.getByRole('button', { name: 'Split', exact: true }).click()
    await expect(source).toContainText('UNSAVED-PDF-END')
  })
}

test('exports DOCX using the docx package', async ({ page, request }) => {
  const id = await create(request, '# DOCX 标题\n\n**加粗** 与列表\n\n- 项目一\n- 项目二')
  await page.goto(`/markdown/${id}`)
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toContainText('DOCX 标题')

  await openExportMenu(page)
  const docxDownload = page.waitForEvent('download', { timeout: 30000 })
  await page.getByRole('menuitem', { name: 'Word (.docx)' }).click()
  expect((await docxDownload).suggestedFilename()).toMatch(/\.docx$/i)
})

test('exports the latest unsaved source rather than the last saved revision', async ({ page, request }) => {
  const id = await create(request, '# 已保存')
  await page.goto(`/markdown/${id}`)
  const source = page.getByRole('textbox', { name: 'Markdown source' })
  await source.fill('# 未保存的最新内容')

  await openExportMenu(page)
  const mdDownload = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Markdown (.md)' }).click()
  const download = await mdDownload
  const downloadPath = await download.path()
  const content = await readFile(downloadPath!, 'utf8')
  expect(content).toBe('# 未保存的最新内容')
})

test('searches owned Markdown documents from the home page', async ({ page, request }) => {
  await create(request, '# 会议纪要\n讨论里程碑', '会议纪要')
  await create(request, '# 项目计划', '项目计划')
  await page.goto('/markdown')
  const search = page.getByRole('searchbox', { name: 'Search Markdown' })
  await search.fill('会议')
  await expect(page.getByRole('article', { name: 'Open document: 会议纪要' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(1)
})

test('adds and removes tags in the editor and persists them across a reload', async ({ page, request }) => {
  const id = await create(request, '# 带标签')
  await page.goto(`/markdown/${id}`)
  await page.getByRole('textbox', { name: 'Add tag' }).fill('阅读')
  await page.getByRole('textbox', { name: 'Add tag' }).press('Enter')
  await expect(page.getByRole('button', { name: 'Remove 阅读' })).toBeVisible()
  await expect.poll(async () => (await db.collection('documents').findOne({ docId: id })).tags).toEqual(['阅读'])
  await page.reload()
  await expect(page.getByRole('button', { name: 'Remove 阅读' })).toBeVisible()
})

test('filters the home by a tag chip', async ({ page, request }) => {
  await create(request, '# 一', '带标签文档')
  await request.post('/api/documents', { headers: headers(), data: { name: '筛选目标', editorType: 'markdown', markdown: '# 二', tags: ['项目'] } })
  await page.goto('/markdown')
  await page.getByRole('button', { name: /项目/ }).click()
  await expect(page.getByRole('article', { name: 'Open document: 筛选目标' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(1)
})

test('shows outgoing links and backlinks in the editor panel', async ({ page, request }) => {
  const target = await create(request, '# 目标正文', '目标文档')
  const source = await request.post('/api/documents', { headers: headers(), data: { editorType: 'markdown', name: '来源文档' } })
  const id = (await source.json()).id as string
  await request.put(`/api/documents/${id}/markdown`, { headers: headers(), data: { markdown: '关联 [[目标文档]]', baseRevision: 0 } })
  await page.goto(`/markdown/${id}`)
  const panel = page.getByRole('complementary', { name: 'Document links' })
  await expect(panel.getByRole('button', { name: '目标文档' })).toBeVisible()
})

test('navigates to a backlink target document', async ({ page, request }) => {
  const target = await create(request, '# 目标正文', '跳转目标')
  const source = await request.post('/api/documents', { headers: headers(), data: { editorType: 'markdown', name: '来源文档' } })
  const sourceId = (await source.json()).id as string
  await request.put(`/api/documents/${sourceId}/markdown`, { headers: headers(), data: { markdown: '关联 [[跳转目标]]', baseRevision: 0 } })
  await page.goto(`/markdown/${target}`)
  const panel = page.getByRole('complementary', { name: 'Document links' })
  await panel.getByRole('button', { name: '来源文档' }).click()
  await expect(page).toHaveURL(new RegExp(`/markdown/${sourceId}$`))
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toContainText('关联 [[跳转目标]]')
})

test('renders unresolved wiki links with a find entry and no navigation', async ({ page, request }) => {
  const id = await create(request, 'See [[Missing Target]]')
  await page.goto(`/markdown/${id}`)
  const preview = page.getByRole('region', { name: 'Markdown preview' })
  await expect(preview.getByRole('link', { name: 'Missing Target' })).toHaveAttribute('href', /\/markdown\?q=/)
})
