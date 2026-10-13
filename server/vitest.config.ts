import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // 在测试文件被 import 之前注入，保证 auth.ts 等模块固化的 JWT_SECRET 与测试一致
    env: { JWT_SECRET: 'test-secret' },
    hookTimeout: 60000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/types.ts', 'src/server.ts'],
      reporter: ['text', 'lcov'],
    },
  },
})
