import { test, expect } from '@playwright/test'

/**
 * 서브내비 탭을 누르면 새 페이지가 맨 위부터 보여야 한다.
 *
 * 과거 두 가지 원인으로 깨졌었다.
 *  1. html { scroll-behavior: smooth } 때문에 라우트 전환의 scrollTop=0 이
 *     애니메이션으로 걸렸다가 도중에 얼어붙어, 맨 위가 아닌 곳(관측: 2~92px)에서 멈췄다.
 *  2. loading.tsx 가 있는 라우트(/news·/bulletins·/gallery)는 구 스크롤 핸들러의
 *     findDOMNode 가 <head>로 호이스팅된 metadata 를 집어 스크롤 자체를 포기했다.
 *     → next.config.ts 의 experimental.appNewScrollHandler 로 해결.
 *
 * 목적지에 콘텐츠가 없으면 검사가 성립하지 않는다 — 아래 skip 참고.
 */
const TOLERANCE = 4

const CASES = [
  { from: '/about/greeting', link: '교회 연혁', to: '/about/history' },
  { from: '/about/history', link: '섬기는 사람들', to: '/about/serving' },
  { from: '/about/serving', link: '담임목사 인사', to: '/about/greeting' },
  { from: '/worship', link: '행복선언', to: '/happiness' },
  // loading.tsx 가 있는 라우트들 — 회귀 시 스크롤이 아예 안 일어난다.
  { from: '/news', link: '주보', to: '/bulletins' },
  { from: '/news', link: '갤러리', to: '/gallery' },
  { from: '/gallery', link: '소식', to: '/news' },
  { from: '/events', link: '주보', to: '/bulletins' },
]

for (const { from, link, to } of CASES) {
  test(`서브내비 ${from} → ${to} 이동 시 맨 위로 스크롤된다`, async ({ page }) => {
    await page.goto(from)

    // 페이지 끝까지 내려서, 이동 후 스크롤이 남아있으면 확실히 드러나게 한다.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(TOLERANCE)

    await page.getByRole('link', { name: link, exact: true }).first().click()
    await page.waitForURL(`**${to}`)

    // Next 의 기본값은 "스크롤 유지"다 — 이동한 Page 요소가 뷰포트 안에 보이면
    // 스크롤하지 않는다. 목록이 비어 콘텐츠가 한 화면에 들어가면(주보를 시드하지
    // 않는 CI) 이 규칙에 걸려 스크롤이 남는데, 회귀와 구분되지 않으므로 건너뛴다.
    const contentOverflowsViewport = await page.evaluate(() => {
      const main = document.querySelector('main')
      return !!main && main.getBoundingClientRect().height > window.innerHeight
    })
    test.skip(!contentOverflowsViewport, `${to} 의 콘텐츠가 한 화면에 들어감 — 게시물이 없는 환경`)

    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5_000 })
      .toBeLessThanOrEqual(TOLERANCE)
  })
}

test('html 에 전역 smooth 스크롤이 다시 들어오지 않았다', async ({ page }) => {
  // 전역 smooth 가 부활하면 라우트 전환 스크롤이 다시 중간에 멈춘다.
  // 부드러운 스크롤이 필요하면 scrollIntoView({ behavior: 'smooth' }) 로 호출부에서 지정할 것.
  await page.goto('/about/greeting')
  const behavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)
  expect(behavior).not.toBe('smooth')
})
