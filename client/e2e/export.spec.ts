import { test, expect } from '@playwright/test'

const uniqueUsername = () => `e2e-export-${Date.now()}`

async function registerAndCreateDoc(page: import('@playwright/test').Page, docName: string) {
  await page.goto('/register')
  await page.fill('input[placeholder="Choose a username"]', uniqueUsername())
  await page.fill('input[placeholder="At least 6 characters"]', 'pass123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')

  await page.click('text=/new/i')
  await page.fill('input[placeholder*="name" i]', docName)
  await page.click('button:has-text("Create"), button:has-text("OK"), button[type="submit"]')
  await expect(page).toHaveURL(/\/document\//, { timeout: 10000 })
}

test.describe('Export functionality', () => {
  test('PDF export button is visible', async ({ page }) => {
    await registerAndCreateDoc(page, 'Export Test Doc')

    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })

    // PDF export button should be present in the toolbar
    await expect(page.locator('button[title="Export as PDF"]')).toBeVisible({ timeout: 5000 })
  })

  test('DOCX export button is visible', async ({ page }) => {
    await registerAndCreateDoc(page, 'Export Test Doc 2')

    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })

    // DOCX export button should be present in the toolbar
    await expect(page.locator('button[title="Export as DOCX"]')).toBeVisible({ timeout: 5000 })
  })

  test('clicking PDF export triggers download', async ({ page }) => {
    await registerAndCreateDoc(page, 'PDF Download Test')

    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })

    // Type some content
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('Content for PDF export.')

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
    await page.locator('button[title="Export as PDF"]').click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
  })

  test('clicking DOCX export triggers download', async ({ page }) => {
    await registerAndCreateDoc(page, 'DOCX Download Test')

    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })

    // Type some content
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('Content for DOCX export.')

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
    await page.locator('button[title="Export as DOCX"]').click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.docx$/i)
  })
})
