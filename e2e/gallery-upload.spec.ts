// 갤러리 앨범 생성 e2e — 클라이언트 이미지 압축 검증이 핵심.
// Vercel 함수는 요청 본문 4.5MB 초과 시 FUNCTION_PAYLOAD_TOO_LARGE로 잘리므로,
// 압축 임계값(3.5MB)을 넘는 원본을 올렸을 때 실제 전송 본문이 한도 밑인지 계측한다.
// 로컬 dev 서버에는 이 한도가 없어서 "성공했다"만으로는 압축을 증명하지 못한다.
//
// 실행 요건: .env.local에 E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (실 DB/R2에 쓰고 지운다)
import { expect, test } from '@playwright/test'
import crypto from 'node:crypto'
import sharp from 'sharp'

const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

const vercelBodyLimit = 4.5 * 1024 * 1024

// 랜덤 노이즈는 JPEG 압축이 거의 안 돼 확실하게 큰 파일이 만들어진다.
async function makeOversizedJpeg() {
  const width = 3200
  const height = 2400
  const raw = crypto.randomBytes(width * height * 3)
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 100 }).toBuffer()
}

test('대용량 표지 업로드 시 전송 본문이 Vercel 4.5MB 한도 밑으로 압축된다', async ({ page }) => {
  test.skip(!email || !password, '.env.local에 E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD가 필요합니다')

  const bigJpeg = await makeOversizedJpeg()
  expect(bigJpeg.byteLength).toBeGreaterThan(vercelBodyLimit)

  // ── 로그인 ──────────────────────────────────────────────────────────────
  await page.goto('/sign-in')
  await page.fill('#email', email!)
  await page.fill('#password', password!)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL('**/admin')

  // ── 서버 액션 POST 본문 크기 계측 ────────────────────────────────────────
  // 대용량 multipart는 postDataBuffer()가 비어 나오므로(CDP 한계)
  // 실제 전송된 content-length 헤더로 잰다.
  const actionBodySizes: Promise<number>[] = []
  page.on('request', (request) => {
    if (request.method() !== 'POST') return
    actionBodySizes.push(
      request
        .allHeaders()
        .then((headers) => (headers['next-action'] ? Number(headers['content-length'] ?? 0) : 0))
        .catch(() => 0)
    )
  })

  // ── 새 앨범 생성 (표지 = 압축 임계값 초과 원본) ──────────────────────────
  const title = `e2e-압축테스트-${Date.now()}`
  await page.goto('/admin/gallery/new')
  await page.fill('#title', title)
  // 실 DB에 쓰므로 테스트 앨범이 공개 갤러리에 노출되지 않게 비공개로 만든다.
  await page.getByLabel('공개').uncheck()
  await page.setInputFiles('#cover', {
    name: 'oversized-photo.jpg',
    mimeType: 'image/jpeg',
    buffer: bigJpeg,
  })
  await page.getByRole('button', { name: '앨범 작성' }).click()

  // 성공하면 목록으로 이동하고 방금 만든 앨범이 보인다.
  await page.waitForURL('**/admin/gallery', { timeout: 60_000 })
  const row = page.getByRole('row').filter({ hasText: title })
  await expect(row).toBeVisible()

  try {
    // ── 핵심 검증: 파일이 실려 간 요청이 존재하고, 원본보다 작고, 한도 밑이다 ──
    const uploadBody = Math.max(...(await Promise.all(actionBodySizes)), 0)
    expect(uploadBody).toBeGreaterThan(10 * 1024) // 파일이 실제로 포함됐는지 최소치 확인
    expect(uploadBody).toBeLessThan(bigJpeg.byteLength)
    expect(uploadBody).toBeLessThan(vercelBodyLimit)
  } finally {
    // ── 정리: 만든 앨범 삭제 (deleteAlbum이 R2 표지 파일까지 지운다) ─────────
    page.on('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: '삭제' }).click()
    await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0, { timeout: 30_000 })
  }
})
