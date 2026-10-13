import { defineConfig } from '@playwright/test'

// 外部已提供应用（如容器栈：PLAYWRIGHT_BASE_URL=http://localhost:3001）时，
// 不再自动拉起本地 dev 双服务；否则按原方式拉起 server(3001) + vite(5173)。
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: externalBaseURL ?? 'http://localhost:5173',
    headless: true,
  },
  webServer: externalBaseURL
    ? undefined
    : [
      {
        command: 'cd ../server && npx ts-node src/server.ts',
        port: 3001,
        timeout: 30000,
        reuseExistingServer: !process.env.CI,
      },
      {
        command: 'npx vite',
        port: 5173,
        timeout: 30000,
        reuseExistingServer: !process.env.CI,
      },
    ],
})
