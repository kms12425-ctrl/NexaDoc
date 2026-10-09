import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'cd ../server && npx ts-node src/server.ts',
      port: 3001,
      timeout: 30000,
    },
    {
      command: 'npx vite',
      port: 5173,
      timeout: 30000,
    },
  ],
})
