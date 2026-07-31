/**
 * 라이트박스 면 이동 계산.
 *
 * 화면 폭과 무관하게 **항상 한 면씩** 띄운다. 초기 설계는 레퍼런스(jangji.org)를 따라
 * 데스크탑에서 3면을 나란히 붙였는데, 3단 접지 주보에서는 한 화면에 9칸이 들어가
 * 어느 폭에서도 읽히지 않았다. 읽는 단위는 면이고, 여러 면을 붙여 얻는 것은 없다.
 *
 * DOM에 의존하지 않는 순수 함수로 둔다 — vitest가 node 환경이라 컴포넌트 테스트를
 * 돌릴 수 없으므로, 판정 로직은 전부 여기에 있어야 검증된다.
 */

/** 면 인덱스(0-based)를 유효 범위로 제한한다. */
export function clampPageIndex(index: number, pageCount: number): number {
  if (pageCount <= 0) return 0
  return Math.min(pageCount - 1, Math.max(0, Math.floor(index)))
}

/** 한 면 이동한다. 양끝에서는 제자리에 머문다. */
export function movePage(index: number, delta: -1 | 1, pageCount: number): number {
  return clampPageIndex(index + delta, pageCount)
}

/** 마지막 면인지 — 「다음 면」 버튼 비활성 판정. */
export function isLastPage(index: number, pageCount: number): boolean {
  return pageCount <= 0 || index >= pageCount - 1
}

/** 툴바 표기. 예: `3 / 6면`. */
export function pageLabel(index: number, pageCount: number): string {
  if (pageCount <= 0) return '0 / 0면'
  return `${clampPageIndex(index, pageCount) + 1} / ${pageCount}면`
}
