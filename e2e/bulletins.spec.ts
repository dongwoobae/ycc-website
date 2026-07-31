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

test('원본 크게 보기로 라이트박스를 열고 이동·휠 줌·Escape 닫기가 동작한다', async ({ page }) => {
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')

  const openButton = page.getByRole('button', { name: '원본 크게 보기' })
  await openButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '닫기' })).toBeFocused()

  // 제스처를 모르는 사용자를 위해 확대 버튼과 글자 라벨이 붙은 이동 버튼이 항상 보인다
  await expect(dialog.getByRole('button', { name: '크게 보기' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '작게 보기' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '화면에 맞추기' })).toBeVisible()
  // 첫 면에서는 「이전 면」 버튼을 렌더하지 않는다
  await expect(dialog.getByRole('button', { name: '이전 면 보기' })).toHaveCount(0)

  const pageCount = Number(/\/ (\d+)면$/.exec((await dialog.getByText(/^\d+ \/ \d+면$/).textContent()) ?? '')?.[1])
  if (pageCount > 1) await expect(dialog.getByRole('button', { name: '다음 면 보기' })).toBeVisible()

  const stage = dialog.getByTestId('bulletin-lightbox-page')
  const before = await stage.evaluate((el) => getComputedStyle(el).transform)
  const box = await stage.boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.wheel(0, -400)
  await expect.poll(() => stage.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')
  // 면을 넘기면 배율이 맞춤으로 되돌아온다
  await expect.poll(() => stage.evaluate((el) => getComputedStyle(el).transform)).toBe(before)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  // 닫으면 포커스가 진입 지점으로 돌아온다
  await expect(openButton).toBeFocused()
})

test('어느 화면 폭에서도 한 면만 띄운다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')
  await page.getByRole('button', { name: '원본 크게 보기' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('bulletin-lightbox-page')).toHaveCount(1)
  await expect(dialog.getByText(/^\d+ \/ \d+면$/)).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(dialog.getByTestId('bulletin-lightbox-page')).toHaveCount(1)
  await expect(dialog.getByText(/^\d+ \/ \d+면$/)).toBeVisible()
})

test('드래그로는 면이 넘어가지 않는다 — 이동은 버튼·면 목록·방향키뿐', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')
  await page.getByRole('button', { name: '원본 크게 보기' }).click()

  const dialog = page.getByRole('dialog')
  const label = dialog.getByText(/^\d+ \/ \d+면$/)
  const before = await label.textContent()

  const box = await dialog.getByTestId('bulletin-lightbox-page').boundingBox()
  const y = box!.y + box!.height / 2
  await page.mouse.move(box!.x + box!.width * 0.8, y)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.1, y, { steps: 10 })
  await page.mouse.up()

  await expect(label).toHaveText(before!)
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
