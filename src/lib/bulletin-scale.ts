/**
 * 주보 면 이미지의 세 크기. 긴 변 기준 픽셀이다.
 * full은 라이트박스, preview는 인라인 큰 이미지·목록 표지·홈 카드, thumb은 인라인 스트립에 쓴다.
 *
 * next.config.ts 가 images.unoptimized:true 라서 next/image 의 sizes 로는 축소본이
 * 생성되지 않는다. 그래서 업로드 시점에 세 크기를 직접 만들어 저장한다.
 */
export const bulletinSizes = { full: 2000, preview: 1000, thumb: 320 } as const

export type BulletinSizeName = keyof typeof bulletinSizes

export const bulletinSizeNames = ['full', 'preview', 'thumb'] as const satisfies readonly BulletinSizeName[]

export interface ScaledSize {
  width: number
  height: number
  scale: number
}

/**
 * 긴 변을 limit 이하로 축소한다. 원본이 limit 이하면 확대하지 않고 그대로 반환한다.
 * 극단적인 종횡비에서도 짧은 변이 0이 되지 않도록 최소 1px을 보장한다.
 */
export function scaleToLongEdge(width: number, height: number, limit: number): ScaledSize {
  if (!(width > 0) || !(height > 0)) throw new Error('invalid dimensions')
  const longEdge = Math.max(width, height)
  if (longEdge <= limit) return { width, height, scale: 1 }
  const scale = limit / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  }
}
