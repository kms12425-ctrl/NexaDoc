import { test, expect } from '@playwright/test'

const uniqueUsername = () => `e2e-collab-${Date.now()}`

test.describe('Real-time collaboration', () => {
  test('two users see each other edits', async ({ browser }) => {
    // Create two browser contexts (two users)
    const user1 = await browser.newContext()
    const user2 = await browser.newContext()

    const page1 = await user1.newPage()
    const page2 = await user2.newPage()

    // Register user1
    await page1.goto('/register')
    await page1.fill('input[placeholder="Choose a username"]', uniqueUsername())
    await page1.fill('input[placeholder="At least 6 characters"]', 'pass123')
    await page1.click('button[type="submit"]')
    await expect(page1).toHaveURL('/')

    // Create a document as user1
    await page1.click('text=/new/i')
    await page1.fill('input[placeholder*="name" i]', 'Collab Test Doc')
    await page1.click('button:has-text("Create"), button:has-text("OK"), button[type="submit"]')
    await expect(page1).toHaveURL(/\/document\//, { timeout: 10000 })

    // Get the doc URL
    const docUrl = page1.url()

    // Register user2
    await page2.goto('/register')
    await page2.fill('input[placeholder="Choose a username"]', uniqueUsername())
    await page2.fill('input[placeholder="At least 6 characters"]', 'pass123')
    await page2.click('button[type="submit"]')
    await expect(page2).toHaveURL('/')

    // User2 opens the same document (via shared link / direct URL)
    await page2.goto(docUrl)

    // Wait for both editors to be ready
    await expect(page1.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })
    await expect(page2.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })

    // User1 types text
    await page1.locator('.ProseMirror').click()
    await page1.keyboard.type('Hello from user 1!')

    // User2 should see the text (with some delay for sync)
    await expect(page2.locator('.ProseMirror')).toContainText('Hello from user 1', { timeout: 15000 })

    // User2 types text
    await page2.locator('.ProseMirror').click()
    await page2.keyboard.press('Enter')
    await page2.keyboard.type('Hello from user 2!')

    // User1 should see user2's text
    await expect(page1.locator('.ProseMirror')).toContainText('Hello from user 2', { timeout: 15000 })

    await user1.close()
    await user2.close()
  })

  test('remote cursor is visible', async ({ browser }) => {
    const user1 = await browser.newContext()
    const user2 = await browser.newContext()

    const page1 = await user1.newPage()
    const page2 = await user2.newPage()

    // Register both users and open the same doc
    await page1.goto('/register')
    await page1.fill('input[placeholder="Choose a username"]', uniqueUsername())
    await page1.fill('input[placeholder="At least 6 characters"]', 'pass123')
    await page1.click('button[type="submit"]')
    await expect(page1).toHaveURL('/')

    await page1.click('text=/new/i')
    await page1.fill('input[placeholder*="name" i]', 'Cursor Test')
    await page1.click('button:has-text("Create"), button:has-text("OK"), button[type="submit"]')
    await expect(page1).toHaveURL(/\/document\//, { timeout: 10000 })

    const docUrl = page1.url()

    await page2.goto('/register')
    await page2.fill('input[placeholder="Choose a username"]', uniqueUsername())
    await page2.fill('input[placeholder="At least 6 characters"]', 'pass123')
    await page2.click('button[type="submit"]')
    await expect(page2).toHaveURL('/')

    await page2.goto(docUrl)

    // Both editors ready
    await expect(page1.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })
    await expect(page2.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })

    // User1 types and places cursor
    await page1.locator('.ProseMirror').click()
    await page1.keyboard.type('Some text here')
    await page1.locator('.ProseMirror').click()

    // User2 should see a remote cursor indicator (collaboration cursor)
    // The cursor is rendered as a span with class containing "collaboration-cursor"
    await expect(page2.locator('.collaboration-cursor__label, [class*="cursor"]')).toBeVisible({ timeout: 15000 })

    await user1.close()
    await user2.close()
  })
})
