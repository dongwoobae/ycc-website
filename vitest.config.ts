import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'src/test/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    // e2e는 Playwright 전용 — vitest가 집지 않게 제외
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
