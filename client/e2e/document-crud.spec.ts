import { test, expect } from '@playwright/test'
import { createDocument, docCard, registerAndLogin, uniqueUsername } from './helpers'

const uniqueDocName = (label: string) => `${label} ${Date.now()}`

test.describe('Document CRUD', () =>
{
    test.beforeEach(async ({ page }) =>
    {
        await registerAndLogin(page, uniqueUsername('e2e-crud'))
    })

    test('create a document', async ({ page }) =>
    {
        const docName = uniqueDocName('Test Doc')
        await createDocument(page, docName)

        // 编辑器加载后标题同步为文档名
        await expect(page.locator('input[aria-label="Document title"]')).toHaveValue(docName, { timeout: 15000 })
        await expect(page.locator('.ProseMirror')).toBeVisible()
    })

    test('document appears in list after creation', async ({ page }) =>
    {
        const docName = uniqueDocName('Listed Doc')
        await createDocument(page, docName)

        await page.goto('/')
        await expect(docCard(page, docName)).toBeVisible({ timeout: 10000 })
    })

    test('delete a document', async ({ page }) =>
    {
        const docName = uniqueDocName('Delete Me')
        await createDocument(page, docName)

        await page.goto('/')
        const card = docCard(page, docName)
        await expect(card).toBeVisible({ timeout: 10000 })

        await card.hover() // 删除按钮平时 opacity:0，hover 才显形
        await page.click(`button[aria-label="Delete ${docName}"]`)
        await page.click('#confirm-delete-doc')

        await expect(card).toHaveCount(0, { timeout: 10000 })
    })

    test('search filters documents', async ({ page }) =>
    {
        const searchable = uniqueDocName('Searchable Doc')
        const other = uniqueDocName('Other Doc')

        for (const name of [searchable, other]) {
            await createDocument(page, name)
            await page.goto('/')
        }

        await page.fill('input[aria-label="Search documents"]', 'Searchable')

        await expect(docCard(page, searchable)).toBeVisible()
        await expect(docCard(page, other)).toHaveCount(0)
    })
})
