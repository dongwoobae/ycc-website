// 갤러리 영상 추가 폼 e2e — 렌더링과 클라이언트 검증까지 확인한다.
// 앨범 생성(표지 업로드·삭제)은 기존 관례대로 실 DB/R2를 사용하지만,
// 영상 R2 직접 PUT은 버킷 CORS 설정(docs/r2-cors-video-upload.md)에 의존하므로
// 여기서는 수행하지 않고 배포 환경에서 수동 검증한다.
import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'

const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

async function makeCoverJpeg() {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 40, g: 200, b: 40 } } })
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

async function deleteAlbum(page: Page, title: string) {
  if (!page.url().endsWith('/admin/gallery')) await page.goto('/admin/gallery')
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('row').filter({ hasText: title }).getByRole('button', { name: '삭제' }).click()
  await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0, { timeout: 30_000 })
}

test('영상 추가 폼이 렌더되고 허용 외 형식은 클라이언트에서 거부한다', async ({ page }) => {
  test.skip(!email || !password, '.env.local에 E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD가 필요합니다')

  await signIn(page)

  const title = `e2e-영상폼-${Date.now()}`
  await page.goto('/admin/gallery/new')
  await page.fill('#title', title)
  await page.getByLabel('공개').uncheck()
  await page.setInputFiles('#cover', { name: 'cover.jpg', mimeType: 'image/jpeg', buffer: await makeCoverJpeg() })
  await page.getByRole('button', { name: '앨범 작성' }).click()
  await page.waitForURL('**/admin/gallery', { timeout: 60_000 })

  try {
    await page.getByRole('row').filter({ hasText: title }).getByRole('link', { name: '수정' }).click()
    await page.waitForURL('**/admin/gallery/**/edit')

    // 폼 렌더 확인
    await expect(page.getByRole('heading', { name: '영상 추가' })).toBeVisible()
    await expect(page.locator('#video')).toHaveAttribute('accept', 'video/mp4,video/quicktime,video/webm')

    // 허용 외 형식 → presign 요청 없이 클라이언트에서 에러 표시
    await page.setInputFiles('#video', {
      name: 'not-a-video.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    })
    await page.getByRole('button', { name: '영상 추가' }).click()
    await expect(page.getByText('지원하지 않는 영상 형식입니다', { exact: false })).toBeVisible()
  } finally {
    await deleteAlbum(page, title)
  }
})
