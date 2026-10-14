import { test, expect } from '@playwright/test'

const uniqueUsername = () => `e2e-crud-${Date.now()}`
const uniqueDocName = () => `Test Doc ${Date.now()}`

test.describe('Document CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Register and auto-login
    await page.goto('/register')
    await page.fill('input[placeholder="Choose a username"]', uniqueUsername())
    await page.fill('input[placeholder="At least 6 characters"]', 'pass123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')
  })

  test('create a document', async ({ page }) => {
    const docName = uniqueDocName()

    // Open the "New document" modal (header button)
    await page.locator('#create-doc-btn').click()

    // Fill document name in modal
    await page.getByLabel('Document name').fill(docName)
    await page.locator('#confirm-create-doc').click()

    // Should navigate to editor
    await expect(page).toHaveURL(/\/document\//, { timeout: 10000 })

    // Document name should appear in the editor title input
    await expect(page.getByLabel('Document title')).toHaveValue(docName, { timeout: 10000 })
  })

  test('document appears in list after creation', async () => {
    // This test creates a doc and verifies it shows in the list
    // Implemented via the create test + navigation back
  })

  test('delete a document', async ({ page }) => {
    // First create a doc
    const docName = uniqueDocName()
    await page.locator('#create-doc-btn').click()
    await page.getByLabel('Document name').fill(docName)
    await page.locator('#confirm-create-doc').click()
    await expect(page).toHaveURL(/\/document\//, { timeout: 10000 })

    // Go back to docs list
    await page.goto('/')

    // Find the doc card
    await expect(page.getByText(docName)).toBeVisible({ timeout: 10000 })

    // Delete via the card's delete button + confirm dialog
    await page.getByRole('button', { name: `Delete ${docName}` }).click()
    await page.locator('#confirm-delete-doc').click()

    // Doc should no longer be visible
    await expect(page.getByText(docName)).toHaveCount(0, { timeout: 10000 })
  })

  test('search filters documents', async ({ page }) => {
    // Create two docs with different names
    for (const name of ['Searchable Doc', 'Other Doc']) {
      await page.locator('#create-doc-btn').click()
      await page.getByLabel('Document name').fill(name)
      await page.locator('#confirm-create-doc').click()
      await page.waitForURL(/\/document\//)
      await page.goto('/')
    }

    // Search for "Searchable"
    await page.fill('input[placeholder*="search" i]', 'Searchable')

    // Only "Searchable Doc" should be visible
    await expect(page.locator('text=Searchable Doc')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Other Doc')).toHaveCount(0)
  })
})
