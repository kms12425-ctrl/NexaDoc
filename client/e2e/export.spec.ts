import { test, expect } from '@playwright/test'
import { createDocument, registerAndLogin, uniqueUsername, waitForEditorReady } from './helpers'

test.describe('Export functionality', () =>
{
    test.beforeEach(async ({ page }) =>
    {
        await registerAndLogin(page, uniqueUsername('e2e-export'))
        await createDocument(page, `Export Doc ${Date.now()}`)
        await waitForEditorReady(page)
    })

    test('PDF export button is visible', async ({ page }) =>
    {
        await expect(page.locator('button[title="Export as PDF"]')).toBeVisible()
    })

    test('DOCX export button is visible', async ({ page }) =>
    {
        await expect(page.locator('button[title="Export as DOCX"]')).toBeVisible()
    })

    test('clicking PDF export triggers download', async ({ page }) =>
    {
        await page.locator('.ProseMirror').click()
        await page.keyboard.type('Content for PDF export.')

        // html2pdf.js 在前端生成，大文档较慢，这里给足超时
        const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
        await page.click('button[title="Export as PDF"]')

        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
    })

    test('clicking DOCX export triggers download', async ({ page }) =>
    {
        await page.locator('.ProseMirror').click()
        await page.keyboard.type('Content for DOCX export.')

        const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
        await page.click('button[title="Export as DOCX"]')

        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/\.docx$/i)
    })
})
