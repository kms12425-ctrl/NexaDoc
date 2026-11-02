import { defineConfig } from '@playwright/test'
import live from './playwright.markdown-live.config'
export default defineConfig({
  ...live, testDir: './e2e-markdown-collab', timeout: 90000,
  outputDir: 'test-results/markdown-collab',
  reporter: [['list'], ['json', { outputFile: 'playwright-report/markdown-collab/results.json' }]],
  webServer: { ...live.webServer as object, env: {
    VITE_MARKDOWN_API_ENABLED: '', VITE_API_URL: '', VITE_YJS_URL: '',
    MARKDOWN_SHARING_ENABLED: 'true', MARKDOWN_COLLAB_ENABLED: 'true', MARKDOWN_E2E_CONTROL: 'true',
  } },
})
