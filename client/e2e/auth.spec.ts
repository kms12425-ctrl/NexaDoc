import { test, expect } from '@playwright/test'
import { registerAndLogin, uniqueUsername } from './helpers'

const USERNAME_INPUT = 'input[placeholder="Enter username"]'
const PASSWORD_INPUT = 'input[placeholder="Enter password"]'

test.describe('Authentication flow', () =>
{
    test('register a new user', async ({ page }) =>
    {
        await registerAndLogin(page, uniqueUsername('e2e-auth'))

        // 注册后落在文档列表页（已登录路由 `/` → DocsPage）
        await expect(page.locator('#create-doc-btn')).toBeVisible()
        await expect(page.locator('.user-badge')).toHaveAttribute('title', /e2e-auth/)
    })

    test('login with existing user', async ({ page }) =>
    {
        const username = await registerAndLogin(page, uniqueUsername('e2e-auth'))

        // 退出登录：回到登录页
        await page.click('.logout-btn')
        await expect(page.locator('.auth-title')).toHaveText('Sign in')

        // 用刚注册的账号重新登录
        await page.fill(USERNAME_INPUT, username)
        await page.fill(PASSWORD_INPUT, 'pass123')
        await page.click('button[type="submit"]')

        await expect(page).toHaveURL('/')
        await expect(page.locator('#create-doc-btn')).toBeVisible()
    })

    test('login with wrong password shows error', async ({ page }) =>
    {
        await page.goto('/') // 未登录时任意路径都渲染登录页
        await page.fill(USERNAME_INPUT, 'nonexistent-user')
        await page.fill(PASSWORD_INPUT, 'wrongpass')
        await page.click('button[type="submit"]')

        await expect(page.locator('.auth-error')).toBeVisible({ timeout: 10000 })
        await expect(page).toHaveURL('/') // 仍停留在登录页
    })

    test('unauthenticated access to editor shows login form', async ({ page }) =>
    {
        // 说明：App.tsx 未登录分支用 path="*" 兜底渲染登录页，因此 URL 保持原样、不做跳转
        await page.goto('/document/some-doc-id')

        await expect(page.locator('.auth-title')).toHaveText('Sign in')
        await expect(page.locator(USERNAME_INPUT)).toBeVisible()
        await expect(page.locator('.ProseMirror')).toHaveCount(0)
    })
})
