import { defineConfig } from '@playwright/test'
import live from './playwright.markdown-live.config'

export default defineConfig({
  ...live,
  testDir: './e2e-markdown-sharing',
  outputDir: 'test-results/markdown-sharing',
  reporter: [['list'], ['json', { outputFile: 'playwright-report/markdown-sharing/results.json' }]],
  webServer: {
    ...live.webServer as object,
    env: { VITE_MARKDOWN_API_ENABLED: '', VITE_API_URL: '', VITE_YJS_URL: '', MARKDOWN_SHARING_ENABLED: 'true', MARKDOWN_COLLAB_ENABLED: 'false' },
  },
})
