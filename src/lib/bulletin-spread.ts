/**
 * 라이트박스 스프레드(동시에 나란히 띄우는 면 묶음) 인덱스 계산.
 *
 * 면 수를 화면 폭으로 결정하는 이유: 레퍼런스(jangji.org)는 3면 고정인데 1900px
 * 폭에서만 성립한다. 모바일에서 3면이면 한 면이 화면 1/3 폭이 되어 확대해도 읽을 수 없다.
 *
 * DOM에 의존하지 않는 순수 함수로 둔다 — vitest가 node 환경이라 컴포넌트 테스트를
 * 돌릴 수 없으므로, 판정 로직은 전부 여기에 있어야 검증된다.
 */

/** 화면 폭으로 동시 표시 면 수를 정한다. */
export function pagesPerSpread(viewportWidth: number): 1 | 2 | 3 {
  if (viewportWidth >= 1280) return 3
  if (viewportWidth >= 768) return 2
  return 1
}

/**
 * 마지막 스프레드의 시작 인덱스.
 * 5면·3면뷰면 0과 3이 스프레드 시작이고, 3번 스프레드는 2면만 담는다.
 * `pageCount - perSpread`로 잡으면 마지막 스프레드가 앞 면을 다시 보여주게 되므로 쓰지 않는다.
 */
export function lastSpreadStart(pageCount: number, perSpread: number): number {
  if (pageCount <= 0) return 0
  return Math.floor((pageCount - 1) / perSpread) * perSpread
}

/** 임의의 시작 인덱스를 스프레드 경계로 내림 정렬하고 유효 범위로 제한한다. */
export function clampSpreadStart(start: number, pageCount: number, perSpread: number): number {
  if (pageCount <= 0) return 0
  const aligned = Math.floor(Math.max(0, start) / perSpread) * perSpread
  return Math.min(aligned, lastSpreadStart(pageCount, perSpread))
}

/** 스프레드 단위로 한 칸 이동한다. 양끝에서는 제자리에 머문다. */
export function moveSpread(start: number, delta: -1 | 1, pageCount: number, perSpread: number): number {
  return clampSpreadStart(start + delta * perSpread, pageCount, perSpread)
}

/**
 * 화면 폭이 바뀌어 perSpread가 변할 때 현재 스프레드의 첫 면을 기준으로 재정렬한다.
 * 3면뷰 4~6면 → 1면뷰면 4면을 보여준다.
 */
export function realignSpread(currentStart: number, pageCount: number, nextPerSpread: number): number {
  return clampSpreadStart(currentStart, pageCount, nextPerSpread)
}

/** 이 스프레드가 담는 면 인덱스(0-based) 목록. */
export function spreadPageIndexes(start: number, pageCount: number, perSpread: number): number[] {
  if (pageCount <= 0) return []
  const first = clampSpreadStart(start, pageCount, perSpread)
  const length = Math.min(perSpread, pageCount - first)
  return Array.from({ length }, (_, offset) => first + offset)
}

/** 툴바 표기. 예: `1 – 3 / 6면`, `4 / 6면`. */
export function spreadLabel(start: number, pageCount: number, perSpread: number): string {
  const indexes = spreadPageIndexes(start, pageCount, perSpread)
  if (indexes.length === 0) return '0 / 0면'
  const first = indexes[0] + 1
  const last = indexes[indexes.length - 1] + 1
  return first === last ? `${first} / ${pageCount}면` : `${first} – ${last} / ${pageCount}면`
}

/** 인라인에서 특정 면을 눌러 라이트박스를 열 때의 스프레드 시작. */
export function spreadStartForPage(pageIndex: number, pageCount: number, perSpread: number): number {
  return clampSpreadStart(pageIndex, pageCount, perSpread)
}
