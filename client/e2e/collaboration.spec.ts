import { test, expect, type Page } from '@playwright/test'
import { createDocument, registerAndLogin, uniqueUsername, waitForEditorReady, typeInEditor } from './helpers'

/** 用户 1：注册 + 新建文档，返回 { 文档 URL, 用户名 } */
async function createSharedDoc(page: Page): Promise<{ url: string; username: string }>
{
    const username = await registerAndLogin(page, uniqueUsername('e2e-collab'))
    await createDocument(page, `Collab Doc ${Date.now()}`)
    await waitForEditorReady(page)
    return { url: page.url(), username }
}

/** 用户 2：注册后直接打开分享链接（默认链接角色为 EDITOR，可直接编辑），返回用户名 */
async function joinDoc(page: Page, url: string): Promise<string>
{
    const username = await registerAndLogin(page, uniqueUsername('e2e-collab'))
    await page.goto(url)
    await waitForEditorReady(page)
    return username
}

test.describe('Real-time collaboration', () =>
{
    test('two users see each other edits', async ({ browser }) =>
    {
        const context1 = await browser.newContext()
        const context2 = await browser.newContext()
        const page1 = await context1.newPage()
        const page2 = await context2.newPage()

        try {
            const { url } = await createSharedDoc(page1)
            await joinDoc(page2, url)

            // 用户 1 输入 → 用户 2 应收到（经 Yjs WebSocket 同步）
            await typeInEditor(page1, 'Hello from user 1')
            await expect(page2.locator('.ProseMirror')).toContainText('Hello from user 1', { timeout: 15000 })

            // 用户 2 继续输入 → 用户 1 应收到
            await page2.locator('.ProseMirror').click()
            await page2.keyboard.press('End')
            await page2.keyboard.press('Enter')
            await page2.keyboard.type('Hello from user 2')
            await expect(page1.locator('.ProseMirror')).toContainText('Hello from user 2', { timeout: 15000 })
        } finally {
            await context1.close()
            await context2.close()
        }
    })

    test('remote cursor is visible', async ({ browser }) =>
    {
        const context1 = await browser.newContext()
        const context2 = await browser.newContext()
        const page1 = await context1.newPage()
        const page2 = await context2.newPage()

        try {
            const { url } = await createSharedDoc(page1)
            const peerName = await joinDoc(page2, url)

            // 双方各自把光标放进正文，才可能看到对方的远端光标
            await typeInEditor(page2, 'user2 was here')
            await typeInEditor(page1, 'user1 was here')

            // TipTap CollaborationCursor 会渲染 .collaboration-cursor__caret / __label（label 为对方用户名）
            const peerCursor = page1.locator('.collaboration-cursor__label').first()
            await expect(peerCursor).toBeVisible({ timeout: 15000 })
            await expect(peerCursor).toHaveText(peerName)
        } finally {
            await context1.close()
            await context2.close()
        }
    })
})
