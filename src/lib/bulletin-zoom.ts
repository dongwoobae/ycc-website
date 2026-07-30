/**
 * 라이트박스 줌·드래그 계산.
 *
 * 핀치줌을 쓰지 않는 이유: 기기·브라우저마다 동작이 갈리고 viewport 설정과 충돌한다.
 * 3단 버튼 + 드래그면 상태 전이가 결정론적이어서 node 환경에서 검증할 수 있다.
 */

export const zoomSteps = ['fit', '1x', '2x'] as const

export type ZoomStep = (typeof zoomSteps)[number]

export interface Size {
  width: number
  height: number
}

export interface Offset {
  x: number
  y: number
}

/** 줌 단계를 한 칸 옮긴다. 양끝을 넘어가지 않는다. */
export function nextZoom(current: ZoomStep, direction: 1 | -1): ZoomStep {
  const index = zoomSteps.indexOf(current)
  const moved = Math.min(zoomSteps.length - 1, Math.max(0, index + direction))
  return zoomSteps[moved]
}

/** 맞춤 단계에서는 콘텐츠가 이미 다 보이므로 드래그를 막는다. */
export function isDraggable(step: ZoomStep): boolean {
  return step !== 'fit'
}

/**
 * 단계에 해당하는 실제 배율.
 * 맞춤은 콘텐츠 전체가 뷰포트에 들어가는 배율이며, 작은 이미지를 늘리지 않도록 1을 넘지 않는다.
 */
export function zoomScale(step: ZoomStep, viewport: Size, content: Size): number {
  if (step === '1x') return 1
  if (step === '2x') return 2
  if (!(content.width > 0) || !(content.height > 0)) return 1
  return Math.min(1, viewport.width / content.width, viewport.height / content.height)
}

/**
 * 드래그 오프셋을 "확대된 콘텐츠가 뷰포트를 벗어난 만큼"으로 제한한다.
 * 콘텐츠가 뷰포트보다 작은 축은 0으로 고정해 여백이 끌려 들어오지 않게 한다.
 */
export function clampOffset(offset: Offset, scale: number, viewport: Size, content: Size): Offset {
  const scaledWidth = content.width * scale
  const scaledHeight = content.height * scale
  const maxX = Math.max(0, (scaledWidth - viewport.width) / 2)
  const maxY = Math.max(0, (scaledHeight - viewport.height) / 2)
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

/** 줌 단계를 바꿀 때의 오프셋. 맞춤으로 돌아가면 항상 0이다. */
export function offsetForStep(step: ZoomStep, offset: Offset, viewport: Size, content: Size): Offset {
  if (step === 'fit') return { x: 0, y: 0 }
  return clampOffset(offset, zoomScale(step, viewport, content), viewport, content)
}
