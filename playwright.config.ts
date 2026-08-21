import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.local' })

// 자격 증명 없이 공개 화면만 읽는 스펙. CI 는 이 목록만 돈다.
const CREDENTIAL_FREE = [/page-chrome\.spec\.ts/, /subnav-scroll\.spec\.ts/]

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  // 실제 DB/R2에 쓰는 시나리오라 동시 실행 시 데이터가 엉킬 수 있어 직렬로 돈다.
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    // CI 에는 직전 단계의 빌드 산출물이 있다 — 실제로 배포되는 것을 잰다.
    command: process.env.CI ? 'npm start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'ci', testMatch: CREDENTIAL_FREE },
    // 관리자 로그인·실 R2 쓰기가 필요한 나머지. 새 스펙은 자동으로 여기 속하므로,
    // CI 에서 돌리려면 CREDENTIAL_FREE 에 명시적으로 올려야 한다.
    { name: 'local', testIgnore: CREDENTIAL_FREE },
  ],
})
