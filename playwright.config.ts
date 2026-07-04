import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.local' })

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  // 실제 DB/R2에 쓰는 시나리오라 동시 실행 시 데이터가 엉킬 수 있어 직렬로 돈다.
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
