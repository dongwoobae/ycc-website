import { expect, test } from '@playwright/test'

// 실제 DB/R2 를 쓰는 시나리오다(playwright.config.ts 가 workers:1 로 직렬 실행).
// 주보가 하나도 없으면 목록에 안내문만 뜨므로 그 경우는 건너뛴다.

async function openLatestBulletin(page: import('@playwright/test').Page) {
  await page.goto('/bulletins')
  const featured = page.getByRole('link', { name: /주보 보기/ }).first()
  if ((await featured.count()) === 0) return false
  await featured.click()
  await expect(page).toHaveURL(/\/bulletins\/[0-9a-f-]+$/)
  return true
}

test('목록에서 상세로 들어가 한눈에 카드가 보인다', async ({ page }) => {
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
  await expect(page.getByText('예배 시간')).toBeVisible()
})

test('썸네일 클릭은 큰 이미지만 바꾸고 라이트박스를 열지 않는다', async ({ page }) => {
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')

  const strip = page.getByTestId('bulletin-thumb-strip')
  test.skip((await strip.count()) === 0, '면이 1장이라 스트립이 없음')

  const before = await page.getByTestId('bulletin-current-page').locator('img').getAttribute('src')
  await strip.getByRole('button', { name: '2면 보기' }).click()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  const after = await page.getByTestId('bulletin-current-page').locator('img').getAttribute('src')
  expect(after).not.toBe(before)
})

test('원본 크게 보기로 라이트박스를 열고 이동·줌·Escape 닫기가 동작한다', async ({ page }) => {
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')

  const openButton = page.getByRole('button', { name: '원본 크게 보기' })
  await openButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '닫기' })).toBeFocused()

  await dialog.getByRole('button', { name: '2배 확대' }).click()
  await expect(dialog.getByRole('button', { name: '2배 확대' })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  // 닫으면 포커스가 진입 지점으로 돌아온다
  await expect(openButton).toBeFocused()
})

test('데스크탑은 3면, 모바일은 1면을 동시에 띄운다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')
  await page.getByRole('button', { name: '원본 크게 보기' }).click()
  const desktopLabel = await page.getByRole('dialog').getByText(/\/ \d+면$/).textContent()

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileLabel = await page.getByRole('dialog').getByText(/\/ \d+면$/).textContent()

  // 데스크탑은 범위 표기(1 – 3), 모바일은 단일 표기(1)
  expect(desktopLabel).not.toBe(mobileLabel)
  expect(mobileLabel).not.toContain('–')
})

test('면이 없는 주보도 상세·목록이 깨지지 않는다', async ({ page }) => {
  // 면 없이 「한눈에」 카드만 등록한 주보를 미리 하나 만들어 둔 뒤 그 URL 을 넣는다.
  // 환경변수가 없으면 건너뛴다 — 데이터 준비를 강제하지 않는다.
  const url = process.env.E2E_EMPTY_BULLETIN_URL
  test.skip(!url, 'E2E_EMPTY_BULLETIN_URL 미설정')

  await page.goto(url!)
  await expect(page.getByText('예배 시간')).toBeVisible()
  // 뷰어 영역과 PDF 버튼이 아예 렌더되지 않는다
  await expect(page.getByText('원본 주보')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '원본 크게 보기' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'PDF 저장' })).toHaveCount(0)

  await page.goto('/bulletins')
  await expect(page.getByRole('link', { name: /주보 보기/ }).first()).toBeVisible()
})

test('같은 날짜의 주보를 또 만들면 사유가 표시된다', async ({ page }) => {
  // 관리자 인증이 필요한 시나리오다. 로그인 상태가 아니면 건너뛴다.
  await page.goto('/admin/bulletins')
  test.skip(page.url().includes('/login'), '관리자 로그인 상태가 아님')

  const existing = page.locator('table tbody tr').first()
  test.skip((await existing.count()) === 0, '기존 주보가 없음')
  const existingDate = (await existing.locator('td').first().textContent())?.trim() ?? ''
  test.skip(!existingDate, '주보일을 읽을 수 없음')

  await page.goto('/admin/bulletins/new')
  await page.getByLabel('주보일').fill(existingDate)
  await page.getByLabel('설교 제목').fill('중복 날짜 확인용')
  await page.getByRole('button', { name: /등록|저장/ }).click()

  await expect(page.getByText('같은 날짜의 주보가 이미 있습니다')).toBeVisible()
})
