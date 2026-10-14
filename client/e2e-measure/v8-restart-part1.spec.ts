/**
 * V-8-5a 重启恢复 · 阶段 1：注册、建文档、写入内容并等待持久化。
 * 阶段间操作：手动重启 server（见会话安排），再运行 part2。
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test('V8-5a 重启恢复·阶段1：创建文档并写入内容', async ({ page }) => {
  const username = 'v8-rst-' + Date.now().toString(36)
  const marker = 'PERSIST-' + Date.now()

  await page.goto('/register')
  await page.fill('input[placeholder="Choose a username"]', username)
  await page.fill('input[placeholder="At least 6 characters"]', 'pass123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')

  await page.locator('#create-doc-btn').click()
  await page.getByLabel('Document name').fill('Restart Test Doc')
  await page.locator('#confirm-create-doc').click()
  await expect(page).toHaveURL(/\/document\//)

  await page.locator('.ProseMirror').click()
  await page.keyboard.type(marker)
  await expect(page.locator('.ProseMirror')).toContainText(marker)

  // 等待服务端持久化（1s debounce + 余量）
  await page.waitForTimeout(3500)

  const state = { docUrl: page.url(), username, password: 'pass123', marker }
  fs.writeFileSync(
    path.join(process.cwd(), 'e2e-measure', '.tmp-restart.json'),
    JSON.stringify(state, null, 2),
  )
  console.log('[V8-5a] 阶段1完成：', JSON.stringify(state))
})
