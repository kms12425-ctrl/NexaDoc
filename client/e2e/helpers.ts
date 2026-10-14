import { expect, type Locator, type Page } from '@playwright/test'

/**
 * e2e 公共辅助——选择器全部对齐真实 UI：
 * - 登录页 `/`（未登录时 `*` 兜底渲染）：`.auth-title` = "Sign in"
 * - 注册页 `/register`：`.auth-title` = "Create account"
 * - 文档列表页：`#create-doc-btn` / `#start-blank-doc`
 * - 新建弹窗：`[aria-label="Document name"]` + `#confirm-create-doc`
 * - 编辑器：`[aria-label="Document title"]`、`.ProseMirror`、`.conn-badge`
 */

/** 每次运行唯一的用户名，避免与库里历史数据冲突 */
export function uniqueUsername(prefix = 'e2e'): string
{
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

/** 注册新用户 → 等待进入文档列表页，返回用户名 */
export async function registerAndLogin(page: Page, username = uniqueUsername()): Promise<string>
{
    await page.goto('/register')
    await expect(page.locator('.auth-title')).toHaveText('Create account')

    await page.fill('input[placeholder="Choose a username"]', username)
    await page.fill('input[placeholder="At least 6 characters"]', 'pass123')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/')
    await expect(page.locator('#create-doc-btn')).toBeVisible()
    return username
}

/** 从文档列表页新建文档（真实流程：Blank document → 弹窗 → Create），返回文档名 */
export async function createDocument(page: Page, name: string): Promise<string>
{
    await page.click('#start-blank-doc')

    const nameInput = page.locator('[aria-label="Document name"]')
    await expect(nameInput).toBeVisible()
    await nameInput.fill(name)

    await page.click('#confirm-create-doc')
    await expect(page).toHaveURL(/\/document\//, { timeout: 15000 })
    return name
}

/** 等待编辑器就绪：正文可见 + Yjs WebSocket 已连接 */
export async function waitForEditorReady(page: Page): Promise<void>
{
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.conn-badge')).toContainText('Connected', { timeout: 20000 })
}

/** 文档卡片定位器（按文档名，对应 DocsPage 的 aria-label） */
export function docCard(page: Page, name: string): Locator
{
    return page.locator(`article[aria-label="Open document: ${name}"]`)
}

/** 在编辑器正文末尾输入文本 */
export async function typeInEditor(page: Page, text: string): Promise<void>
{
    const editor = page.locator('.ProseMirror')
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(text)
}
