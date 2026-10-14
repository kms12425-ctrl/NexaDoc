import { test, expect } from '@playwright/test'

const uniqueUsername = () => `e2e-user-${Date.now()}`

test.describe('Authentication flow', () => {
  test('register a new user', async ({ page }) => {
    await page.goto('/register')

    await page.fill('input[placeholder="Choose a username"]', uniqueUsername())
    await page.fill('input[placeholder="At least 6 characters"]', 'pass123')
    await page.click('button[type="submit"]')

    // Should redirect to docs page
    await expect(page).toHaveURL('/')
    // DocsPage should show the "New document" button
    await expect(page.locator('#create-doc-btn')).toBeVisible({ timeout: 10000 })
  })

  test('login with existing user', async ({ page }) => {
    const username = uniqueUsername()

    // First register
    await page.goto('/register')
    await page.fill('input[placeholder="Choose a username"]', username)
    await page.fill('input[placeholder="At least 6 characters"]', 'pass123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Logout (click logout button)
    await page.reload()
    await page.locator('.logout-btn').click()
    await expect(page).toHaveURL(/login|register/)

    // Login again
    await page.goto('/login')
    await page.fill('input[placeholder="Enter username"]', username)
    await page.fill('input[placeholder="Enter password"]', 'pass123')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/')
  })

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Enter username"]', 'nonexistent-user')
    await page.fill('input[placeholder="Enter password"]', 'wrongpass')
    await page.click('button[type="submit"]')

    // Should show error message (not redirect)
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 5000 })
  })

  test('unauthenticated access to editor redirects to login', async ({ page }) => {
    await page.goto('/document/some-doc-id')
    await expect(page).toHaveURL(/login|register/)
  })
})
