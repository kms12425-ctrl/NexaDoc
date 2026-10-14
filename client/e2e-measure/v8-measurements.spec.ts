/**
 * V-8 实测组：同步延迟 / 断网恢复 / 权限矩阵 / 大文档
 *
 * 前置：由外部终端启动 server(3001) 与 vite(5173)；MongoDB(27017) 运行中。
 * 运行：cd client && npx playwright test --config playwright.measure.config.ts v8-measurements --reporter=line
 */
import { test, expect, Page } from '@playwright/test'

const API = 'http://localhost:3001'
const rnd = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

async function register(page: Page, username: string, password = 'pass123')
{
    await page.goto('/register')
    await page.fill('input[placeholder="Choose a username"]', username)
    await page.fill('input[placeholder="At least 6 characters"]', password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')
}

async function createDoc(page: Page, name: string): Promise<string>
{
    await page.locator('#create-doc-btn').click()
    await page.getByLabel('Document name').fill(name)
    await page.locator('#confirm-create-doc').click()
    await expect(page).toHaveURL(/\/document\//)
    return page.url()
}

async function tokenOf(page: Page): Promise<string>
{
    return (await page.evaluate(() => sessionStorage.getItem('cdocs_token'))) as string
}

async function share(ownerPage: Page, docUrl: string, username: string, role: string)
{
    const docId = docUrl.split('/document/')[1]
    const token = await tokenOf(ownerPage)
    const res = await ownerPage.request.post(`${API}/api/documents/${docId}/share`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { username, role },
    })
    expect(res.ok()).toBeTruthy()
}

test('V8-1 同步延迟：10 轮双页面测量', async ({ browser }) =>
{
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()

    await register(p1, 'v8-lat-' + rnd())
    const docUrl = await createDoc(p1, 'Latency Test')
    await register(p2, 'v8-lat2-' + rnd())
    await p2.goto(docUrl)
    await expect(p1.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })
    await expect(p2.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })

    const results: number[] = []
    for (let i = 0; i < 10; i++) {
        const marker = `M${i}X${rnd()} `
        const t0 = Date.now()
        await p1.locator('.ProseMirror').click()
        await p1.keyboard.type(marker)
        await p2.waitForFunction(
            (m) =>
            {
                const el = document.querySelector('.ProseMirror')
                return !!el && (el.textContent || '').includes(m)
            },
            marker,
            { timeout: 15000, polling: 20 },
        )
        const dt = Date.now() - t0
        results.push(dt)
        console.log(`[V8-1 latency] round ${i + 1}: ${dt} ms`)
    }

    const sorted = [...results].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]
    console.log(
        `[V8-1 latency] min=${sorted[0]}ms median=${median}ms p95=${p95}ms max=${sorted[sorted.length - 1]}ms (n=${results.length})`,
    )
    console.log('[V8-1 latency] 方法说明：同机双浏览器上下文；含输入与 20ms 轮询误差，首轮含聚焦开销')
    expect(median).toBeLessThan(3000)

    await ctx1.close()
    await ctx2.close()
})

test('V8-2 断网编辑与恢复同步', async ({ browser }) =>
{
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()

    await register(p1, 'v8-off-' + rnd())
    const docUrl = await createDoc(p1, 'Offline Test')
    await register(p2, 'v8-off2-' + rnd())
    await p2.goto(docUrl)
    await expect(p1.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })
    await expect(p2.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })

    // 基线同步
    await p1.locator('.ProseMirror').click()
    await p1.keyboard.type('BASELINE ')
    await expect(p2.locator('.ProseMirror')).toContainText('BASELINE', { timeout: 15000 })
    console.log('[V8-2 offline] 基线同步 OK')

    // p2 断网
    await ctx2.setOffline(true)
    await p2.locator('.ProseMirror').click()
    await p2.keyboard.type('OFFLINE-EDIT ')
    await expect(p2.locator('.ProseMirror')).toContainText('OFFLINE-EDIT', { timeout: 5000 })
    console.log('[V8-2 offline] 断网期间本地编辑成功（未丢失，本地可见）')

    // p1 在线继续编辑
    await p1.locator('.ProseMirror').click()
    await p1.keyboard.press('Control+End')
    await p1.keyboard.type(' ONLINE-EDIT ')
    console.log('[V8-2 offline] 断网期间对端（在线）继续编辑 OK')

    // 恢复联网，测量收敛
    const t1 = Date.now()
    await ctx2.setOffline(false)
    await expect(p2.locator('.ProseMirror')).toContainText('ONLINE-EDIT', { timeout: 30000 })
    await expect(p1.locator('.ProseMirror')).toContainText('OFFLINE-EDIT', { timeout: 30000 })
    const dt = Date.now() - t1
    console.log(`[V8-2 offline] 恢复联网 → 双端收敛：约 ${dt} ms（含 reconnect 与同步）`)

    await ctx1.close()
    await ctx2.close()
})

test('V8-3 分享与权限：editor 可编辑 / reader 观察 / 移除后行为', async ({ browser }) =>
{
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const ctx3 = await browser.newContext()
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()
    const p3 = await ctx3.newPage()

    const u1 = 'v8-own-' + rnd()
    const u2 = 'v8-edt-' + rnd()
    const u3 = 'v8-rdr-' + rnd()

    await register(p1, u1)
    const docUrl = await createDoc(p1, 'Perm Test')
    await register(p2, u2)
    await register(p3, u3)

    await share(p1, docUrl, u2, 'editor')
    await share(p1, docUrl, u3, 'reader')
    console.log(`[V8-3 perm] 已邀请 ${u2}=editor, ${u3}=reader（API）`)

    // editor 通过直链打开并编辑
    await p2.goto(docUrl)
    await expect(p2.locator('.ProseMirror')).toBeVisible({ timeout: 15000 })
    await p2.locator('.ProseMirror').click()
    await p2.keyboard.type('EDITOR-CAN-TYPE ')
    await expect(p1.locator('.ProseMirror')).toContainText('EDITOR-CAN-TYPE', { timeout: 15000 })
    console.log('[V8-3 perm] editor 编辑并同步至 owner：OK ✅')

    // reader 行为观察（如实记录，不设硬断言）
    await p3.goto(docUrl)
    const pmVisible = await p3
        .locator('.ProseMirror')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => true)
        .catch(() => false)
    const editable = pmVisible ? await p3.locator('.ProseMirror').getAttribute('contenteditable') : null
    const lenBefore = pmVisible ? ((await p3.locator('.ProseMirror').textContent()) || '').length : 0
    console.log(`[V8-3 perm] reader 打开：编辑器可见=${pmVisible} contenteditable=${editable} 可见文本长度=${lenBefore}`)
    if (pmVisible) {
        await p3.locator('.ProseMirror').click()
        await p3.keyboard.type('READER-TRIED ')
        await p3.waitForTimeout(800)
        const typedLocally = ((await p3.locator('.ProseMirror').textContent()) || '').includes('READER-TRIED')
        console.log(`[V8-3 perm] reader 输入后本地可见=${typedLocally}`)
        await p1.waitForTimeout(1500)
        const ownerSees = ((await p1.locator('.ProseMirror').textContent()) || '').includes('READER-TRIED')
        console.log(`[V8-3 perm] reader 输入是否同步到 owner=${ownerSees}`)
        console.log('[V8-3 perm] 备注：只读端协作体验属 FR-D5 规划补全项，以上为现状如实记录')
    }

    // 移除 editor（API），观察移除后的行为
    const token = await tokenOf(p1)
    const docId = docUrl.split('/document/')[1]
    const accessRes = await p1.request.get(`${API}/api/documents/${docId}/access`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    const accessList = await accessRes.json()
    const u2id = accessList.find((a: any) => a.username === u2)?.userId
    expect(u2id).toBeTruthy()
    const delRes = await p1.request.delete(`${API}/api/documents/${docId}/access/${u2id}`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    expect(delRes.ok()).toBeTruthy()
    console.log('[V8-3 perm] 已移除 editor（API）✅')

    await p2.reload()
    await p2.waitForTimeout(2500)
    const pm2 = await p2
        .locator('.ProseMirror')
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true)
        .catch(() => false)
    const editable2 = pm2 ? await p2.locator('.ProseMirror').getAttribute('contenteditable') : null
    console.log(`[V8-3 perm] 移除后 editor reload：URL=${p2.url()} 编辑器可见=${pm2} contenteditable=${editable2}`)
    if (pm2) {
        await p2.locator('.ProseMirror').click()
        await p2.keyboard.type('REMOVED-TRIED ')
        await p1.waitForTimeout(1500)
        const ownerSees2 = ((await p1.locator('.ProseMirror').textContent()) || '').includes('REMOVED-TRIED')
        console.log(`[V8-3 perm] 移除后输入是否同步到 owner=${ownerSees2}（进行中会话的收回时效为观察项）`)
    }

    await ctx1.close()
    await ctx2.close()
    await ctx3.close()
})

test('V8-4 大文档：插入约 2 万字并同步/持久化', async ({ browser }) =>
{
    test.setTimeout(150000)
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()

    await register(p1, 'v8-big-' + rnd())
    const docUrl = await createDoc(p1, 'Big Doc Test')
    await register(p2, 'v8-big2-' + rnd())
    await p2.goto(docUrl)
    await expect(p1.locator('.ProseMirror')).toBeVisible({ timeout: 30000 })
    await expect(p2.locator('.ProseMirror')).toBeVisible({ timeout: 30000 })

    const block = '这是一段用于大文档压力测试的中文文本，包含标点、数字12345与英文 words。'
    const target = 20000
    const big = block.repeat(Math.ceil(target / block.length)).slice(0, target)

    const t0 = Date.now()
    await p1.locator('.ProseMirror').click()
    await p1.keyboard.insertText(big)
    const tLocal = Date.now() - t0
    console.log(`[V8-4 big] 插入 ${target} 字：本地完成 ${tLocal} ms`)

    const t1 = Date.now()
    await p2.waitForFunction(
        () => ((document.querySelector('.ProseMirror')?.textContent) || '').length > 15000,
        undefined,
        { timeout: 60000, polling: 500 },
    )
    const tRemote = Date.now() - t1
    console.log(`[V8-4 big] 远端同步完成：${tRemote} ms（等待远端 >15000 字）`)

    await p1.waitForTimeout(3000)
    await p1.reload()
    await expect(p1.locator('.ProseMirror')).toBeVisible({ timeout: 20000 })
    await p1.waitForFunction(
        () => ((document.querySelector('.ProseMirror')?.textContent) || '').length > 15000,
        undefined,
        { timeout: 30000, polling: 500 },
    )
    console.log('[V8-4 big] 刷新后内容仍在（服务端持久化 OK）✅')

    await ctx1.close()
    await ctx2.close()
})
