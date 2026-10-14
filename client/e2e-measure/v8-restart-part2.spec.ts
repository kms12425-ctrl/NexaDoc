/**
 * V-8-5b 重启恢复 · 阶段 2：server 重启后重新登录并打开文档，验证内容完好。
 * 前置：已运行 part1，且期间已重启 server。
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test('V8-5b 重启恢复·阶段2：服务重启后内容完好', async ({ page }) => {
  const state = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'e2e-measure', '.tmp-restart.json'), 'utf-8'),
  ) as { docUrl: string; username: string; password: string; marker: string }

  await page.goto('/login')
  await page.fill('input[placeholder="Enter username"]', state.username)
  await page.fill('input[placeholder="Enter password"]', state.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')

  await page.goto(state.docUrl)
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.ProseMirror')).toContainText(state.marker, { timeout: 30000 })
  console.log(`[V8-5b] 阶段2完成：重启后内容仍在（marker=${state.marker}）✅`)
})
