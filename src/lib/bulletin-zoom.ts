/**
 * 라이트박스 줌·드래그 계산.
 *
 * 연속 줌이다 — 터치·트랙패드는 두 손가락 벌리기, 데스크탑은 휠 스크롤로 배율이 이어서 변한다.
 * 단계 버튼(맞춤 / 1× / 2×)은 두지 않는다: 주보 면은 기기마다 읽히는 배율이 달라서
 * 고정 단계가 "조금만 더"를 표현하지 못한다.
 *
 * 배율은 「맞춤」을 1로 보는 **상대값**이다. 면 픽셀 크기·화면 크기와 무관하게 같은 범위로
 * 클램프되므로 상한이 기기별로 달라지지 않고, DOM 없이 node 환경에서 검증할 수 있다.
 */

/** 맞춤보다 더 축소하지 않는다 — 여백만 늘어나고 얻는 것이 없다. */
export const minZoom = 1
/** 맞춤 대비 상한. 모바일 1면 기준으로 자연 크기의 1.5배쯤이라 픽셀이 뭉개지기 직전이다. */
export const maxZoom = 8

export interface Size {
  width: number
  height: number
}

export interface Offset {
  x: number
  y: number
}

/** 줌 배율과 그 배율에서의 이동 오프셋. 둘은 항상 함께 바뀌므로 한 값으로 묶는다. */
export interface ZoomState {
  zoom: number
  offset: Offset
}

/** 시작 상태 — 면 전체가 화면에 들어온 배율. 확대는 사용자가 직접 한다. */
export const fitView: ZoomState = { zoom: minZoom, offset: { x: 0, y: 0 } }

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return minZoom
  return Math.min(maxZoom, Math.max(minZoom, zoom))
}

/**
 * 콘텐츠 전체가 뷰포트에 들어가는 배율.
 * 작은 이미지를 늘리지 않도록 1을 넘지 않으며, 크기를 아직 못 재면 1로 폴백한다.
 */
export function fitScale(viewport: Size, content: Size): number {
  if (!(content.width > 0) || !(content.height > 0)) return 1
  return Math.min(1, viewport.width / content.width, viewport.height / content.height)
}

/** 상대 배율을 실제 CSS transform 배율로 바꾼다. */
export function scaleFor(zoom: number, viewport: Size, content: Size): number {
  return fitScale(viewport, content) * clampZoom(zoom)
}

/** 맞춤 배율에서는 콘텐츠가 이미 다 보이므로 드래그할 것이 없다. */
export function isDraggable(zoom: number): boolean {
  return clampZoom(zoom) > minZoom
}

/**
 * 드래그 오프셋을 "확대된 콘텐츠가 뷰포트를 벗어난 만큼"으로 제한한다.
 * 콘텐츠가 뷰포트보다 작은 축은 0으로 고정해 여백이 끌려 들어오지 않게 한다.
 */
export function clampOffset(offset: Offset, scale: number, viewport: Size, content: Size): Offset {
  const maxX = Math.max(0, (content.width * scale - viewport.width) / 2)
  const maxY = Math.max(0, (content.height * scale - viewport.height) / 2)
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

/**
 * 앵커(포인터 위치 또는 두 손가락의 중점)를 고정한 채 배율을 `target`으로 바꾼다.
 * 앵커는 **스테이지 중심 기준 좌표**다 — transform-origin 이 center 이므로 같은 원점을 쓴다.
 *
 * 중심 고정으로 확대하면 읽으려던 지점이 화면 밖으로 밀려난다. 손가락·커서 아래에 있던
 * 콘텐츠 지점이 그 자리에 그대로 남아야 확대가 "들여다보기"로 느껴진다.
 */
export function zoomAt(current: ZoomState, target: number, anchor: Offset, viewport: Size, content: Size): ZoomState {
  const zoom = clampZoom(target)
  const base = fitScale(viewport, content)
  const from = base * clampZoom(current.zoom)
  const to = base * zoom
  // 실측 전에는 배율이 0일 수 있다. 나눌 수 없으므로 중앙으로 돌린다.
  if (!(from > 0)) return { zoom, offset: { x: 0, y: 0 } }

  const point = {
    x: (anchor.x - current.offset.x) / from,
    y: (anchor.y - current.offset.y) / from,
  }
  const offset = { x: anchor.x - point.x * to, y: anchor.y - point.y * to }
  return { zoom, offset: clampOffset(offset, to, viewport, content) }
}

/** 현재 배율에서 드래그로 옮긴 오프셋을 클램프한다. */
export function panTo(current: ZoomState, offset: Offset, viewport: Size, content: Size): ZoomState {
  return {
    zoom: current.zoom,
    offset: clampOffset(offset, scaleFor(current.zoom, viewport, content), viewport, content),
  }
}

/** 휠 delta 를 픽셀로 정규화한다. Firefox 는 줄(1), 일부 환경은 페이지(2) 단위로 준다. */
function pixelDelta(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * 16
  if (deltaMode === 2) return deltaY * 400
  return deltaY
}

/**
 * 휠 한 번이 배율에 곱해지는 값.
 *
 * 지수로 잡는 이유: 트랙패드는 한 번에 delta 몇 px 을 여러 번 보내고 휠은 100씩 한 번에 보낸다.
 * 선형이면 트랙패드가 안 움직이거나 휠이 튀는데, 지수면 누적 결과가 같은 감각이 된다.
 * 한 번에 뒤집히지 않도록 delta 를 ±120 으로 자른다.
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  const delta = Math.min(120, Math.max(-120, pixelDelta(deltaY, deltaMode)))
  return Math.exp(-delta / 400)
}

/** 두 포인터 사이 거리. 핀치 배율의 기준이다. */
export function distance(a: Offset, b: Offset): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** 두 포인터의 중점. 핀치의 앵커다. */
export function midpoint(a: Offset, b: Offset): Offset {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
