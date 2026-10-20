import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-markdown-live',
  workers: 1,
  timeout: 60000,
  outputDir: 'test-results/a123-live',
  reporter: [['list'], ['json', { outputFile: 'playwright-report/a123/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3018',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build -- --outDir playwright-report/a123/dist && npm --prefix ../server run build && node ../server/scripts/markdown-e2e-server.cjs',
    env: { VITE_MARKDOWN_API_ENABLED: '', VITE_API_URL: '', VITE_YJS_URL: '' },
    url: 'http://127.0.0.1:3018/health',
    timeout: 90000,
    reuseExistingServer: false,
  },
})
