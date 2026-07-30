import { expect, test } from '@playwright/test'

/**
 * 히어로·서브내비는 layout 이 한 번만 렌더해야 한다.
 *
 * loading.tsx 와 page.tsx 가 각자 히어로를 렌더하면 스트림 HTML 에 히어로가 두 번 들어가고,
 * 브라우저에서 fallback → 콘텐츠로 교체될 때 히어로가 unmount 후 다시 mount 되어
 * Reveal 진입 애니메이션이 두 번 재생된다(글자가 두 번 올라옴).
 *
 * 라이브 DOM 은 fallback 이 이미 걷힌 상태라 결함이 드러나지 않으므로,
 * JS 를 실행하지 않는 원본 응답 HTML 을 검사한다.
 */
const sections = ['/sermons', '/news', '/bulletins', '/gallery']

for (const path of sections) {
  test(`${path} 응답 HTML 에 히어로와 서브내비가 각각 하나만 있다`, async ({ page }) => {
    const response = await page.request.get(path)
    expect(response.ok()).toBe(true)

    const html = await response.text()
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
    expect(html.match(/aria-label="[^"]*하위 메뉴"/g) ?? []).toHaveLength(1)
  })
}
