import { defineConfig } from '@playwright/test'

// Mock API verification; builds both flag states without changing the normal dist/.
export default defineConfig({
  testDir: '.',
  testMatch: [
    'e2e-markdown/markdown-home.spec.ts',
    'e2e/workspace-navigation.spec.ts',
    'e2e/shared-components.spec.ts',
  ],
  outputDir: 'test-results/c4-c5-browser',
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'playwright-report/c4-c5/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5186',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run build -- --outDir playwright-report/c4-c5/enabled && npm run preview -- --outDir playwright-report/c4-c5/enabled --host 127.0.0.1 --port 5186 --strictPort',
      env: { VITE_MARKDOWN_API_ENABLED: 'true' },
      url: 'http://127.0.0.1:5186',
      timeout: 90000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run build -- --outDir playwright-report/c4-c5/disabled && npm run preview -- --outDir playwright-report/c4-c5/disabled --host 127.0.0.1 --port 5187 --strictPort',
      env: { VITE_MARKDOWN_API_ENABLED: 'false' },
      url: 'http://127.0.0.1:5187',
      timeout: 90000,
      reuseExistingServer: false,
    },
  ],
})
