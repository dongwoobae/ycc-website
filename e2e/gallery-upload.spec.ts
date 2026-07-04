// 갤러리 업로드 e2e — 클라이언트 이미지 압축 + 병렬 업로드 검증.
// Vercel 함수는 요청 본문 4.5MB 초과 시 FUNCTION_PAYLOAD_TOO_LARGE로 잘리므로,
// 압축 임계값(3.5MB)을 넘는 원본을 올렸을 때 실제 전송 본문이 한도 밑인지 계측한다.
// 로컬 dev 서버에는 이 한도가 없어서 "성공했다"만으로는 압축을 증명하지 못한다.
//
// 실행 요건: .env.local에 E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (실 DB/R2에 쓰고 지운다)
import { expect, test, type Page } from '@playwright/test'
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

async function makeSmallJpeg(r: number, g: number, b: number) {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: { r, g, b } } })
    .jpeg({ quality: 80 })
    .toBuffer()
}

async function signIn(page: Page) {
  await page.goto('/sign-in')
  await page.fill('#email', email!)
  await page.fill('#password', password!)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL('**/admin')
}

// 실 DB에 쓰므로 테스트 앨범은 비공개로 만들고, 끝나면 반드시 지운다.
async function createUnpublishedAlbum(page: Page, title: string, cover: Buffer) {
  await page.goto('/admin/gallery/new')
  await page.fill('#title', title)
  await page.getByLabel('공개').uncheck()
  await page.setInputFiles('#cover', { name: 'cover.jpg', mimeType: 'image/jpeg', buffer: cover })
  await page.getByRole('button', { name: '앨범 작성' }).click()
  await page.waitForURL('**/admin/gallery', { timeout: 60_000 })
  return page.getByRole('row').filter({ hasText: title })
}

async function deleteAlbum(page: Page, title: string) {
  if (!page.url().endsWith('/admin/gallery')) await page.goto('/admin/gallery')
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('row').filter({ hasText: title }).getByRole('button', { name: '삭제' }).click()
  await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0, { timeout: 30_000 })
}

test('대용량 표지 업로드 시 전송 본문이 Vercel 4.5MB 한도 밑으로 압축된다', async ({ page }) => {
  test.skip(!email || !password, '.env.local에 E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD가 필요합니다')

  const bigJpeg = await makeOversizedJpeg()
  expect(bigJpeg.byteLength).toBeGreaterThan(vercelBodyLimit)

  await signIn(page)

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

  const title = `e2e-압축테스트-${Date.now()}`
  await expect(await createUnpublishedAlbum(page, title, bigJpeg)).toBeVisible()

  try {
    // ── 핵심 검증: 파일이 실려 간 요청이 존재하고, 원본보다 작고, 한도 밑이다 ──
    const uploadBody = Math.max(...(await Promise.all(actionBodySizes)), 0)
    expect(uploadBody).toBeGreaterThan(10 * 1024) // 파일이 실제로 포함됐는지 최소치 확인
    expect(uploadBody).toBeLessThan(bigJpeg.byteLength)
    expect(uploadBody).toBeLessThan(vercelBodyLimit)
  } finally {
    await deleteAlbum(page, title) // deleteAlbum 액션이 R2 파일까지 지운다
  }
})

test('여러 장 동시 선택 시 병렬 업로드되고 각 요청이 4.5MB 한도 밑이다', async ({ page }) => {
  test.skip(!email || !password, '.env.local에 E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD가 필요합니다')

  const [bigJpeg, red, blue, cover] = await Promise.all([
    makeOversizedJpeg(),
    makeSmallJpeg(200, 40, 40),
    makeSmallJpeg(40, 40, 200),
    makeSmallJpeg(40, 200, 40),
  ])

  await signIn(page)

  // ── 병렬 업로드 API 요청 계측 (본문 크기) ─────────────────────────────────
  const uploadBodySizes: Promise<number>[] = []
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().includes('/api/admin/gallery/upload')) return
    uploadBodySizes.push(
      request.allHeaders().then((headers) => Number(headers['content-length'] ?? 0)).catch(() => 0)
    )
  })

  const title = `e2e-병렬업로드-${Date.now()}`
  const row = await createUnpublishedAlbum(page, title, cover)

  try {
    // ── 수정 페이지에서 3장 동시 선택 업로드 (대용량 1 + 소용량 2) ────────────
    await row.getByRole('link', { name: '수정' }).click()
    await page.waitForURL('**/admin/gallery/**/edit')

    await page.setInputFiles('#image', [
      { name: 'oversized.jpg', mimeType: 'image/jpeg', buffer: bigJpeg },
      { name: 'small-red.jpg', mimeType: 'image/jpeg', buffer: red },
      { name: 'small-blue.jpg', mimeType: 'image/jpeg', buffer: blue },
    ])
    await page.getByRole('button', { name: '사진 추가' }).click()

    // 3장 모두 사진 목록에 나타난다.
    await expect(page.locator('figure')).toHaveCount(3, { timeout: 90_000 })

    // 업로드 API로 파일당 1건씩 갔고, 전부 Vercel 한도 밑이다.
    const sizes = (await Promise.all(uploadBodySizes)).filter((size) => size > 0)
    expect(sizes).toHaveLength(3)
    for (const size of sizes) {
      expect(size).toBeGreaterThan(1024)
      expect(size).toBeLessThan(vercelBodyLimit)
    }

    // ── 개별 캡션 인라인 수정 ────────────────────────────────────────────────
    const firstCard = page.locator('figure').first()
    await firstCard.getByRole('button', { name: '수정' }).click()
    await firstCard.getByPlaceholder('캡션').fill('e2e 수정된 캡션')
    await firstCard.getByRole('button', { name: '저장' }).click()
    await expect(firstCard.getByText('e2e 수정된 캡션')).toBeVisible({ timeout: 30_000 })
  } finally {
    await deleteAlbum(page, title) // 이미지 3장 + 표지 R2 파일까지 연쇄 삭제
  }
})
