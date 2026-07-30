import { expect, test } from '@playwright/test'

/**
 * 히어로·서브내비는 layout 이 한 번만 렌더해야 한다.
 *
 * loading.tsx 와 page.tsx 가 각자 히어로를 렌더하면 스트림 HTML 에 히어로가 두 번 들어가고,
 * 브라우저에서 fallback → 콘텐츠로 교체될 때 히어로가 unmount 후 다시 mount 된다.
 * 공개 화면은 히어로에 Reveal 이 걸려 있어 진입 애니메이션이 두 번 재생된다(글자가 두 번 올라옴).
 *
 * 라이브 DOM 은 fallback 이 이미 걷힌 상태라 결함이 드러나지 않으므로,
 * JS 를 실행하지 않는 원본 응답 HTML 을 검사한다.
 */
const publicSections = ['/sermons', '/news', '/bulletins', '/gallery']

for (const path of publicSections) {
  test(`${path} 응답 HTML 에 히어로와 서브내비가 각각 하나만 있다`, async ({ page }) => {
    const response = await page.request.get(path)
    expect(response.ok()).toBe(true)

    const html = await response.text()
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
    expect(html.match(/aria-label="[^"]*하위 메뉴"/g) ?? []).toHaveLength(1)
  })
}

// 관리자 화면은 AdminPageHero 를 쓴다(Reveal 없음 — 애니메이션 재생 문제는 없지만
// 스트림 HTML 에 히어로가 두 번 들어가고 로딩 중 히어로가 remount 된다).
const adminSections = [
  '/admin/analytics',
  '/admin/log',
  '/admin/bulletins',
  '/admin/gallery',
  '/admin/posts',
  '/admin/sermons',
]

for (const path of adminSections) {
  test(`${path} 응답 HTML 에 히어로가 하나만 있다`, async ({ page }) => {
    // 로그인 상태가 아니면 /sign-in 으로 리다이렉트되므로 검사할 것이 없다.
    await page.goto(path)
    test.skip(!page.url().includes(path), '관리자 로그인 상태가 아님')

    const response = await page.request.get(path)
    expect(response.ok()).toBe(true)

    const html = await response.text()
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
  })
}
