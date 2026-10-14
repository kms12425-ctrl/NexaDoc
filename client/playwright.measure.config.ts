import { defineConfig } from '@playwright/test'

/**
 * V-8 实测专用配置。
 * 与正式 e2e 套件（playwright.config.ts）隔离：
 * - testDir: ./e2e-measure
 * - server 不自动启动（由外部终端管理，便于中途重启 server 做"重启恢复"实测）；vite 由 webServer 自动管理
 * - workers: 1（串行执行，减少测量噪声）
 */
export default defineConfig({
    testDir: './e2e-measure',
    timeout: 90000,
    workers: 1,
    use: {
        baseURL: 'http://localhost:5173',
        headless: true,
    },
    // vite 由 Playwright 自动管理（保证每次运行都在跑；server 仍由外部终端控制，便于重启实测）
    webServer: [
        {
            command: 'npx vite',
            port: 5173,
            reuseExistingServer: true,
            timeout: 30000,
        },
    ],
})
