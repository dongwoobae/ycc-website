export type ThumbnailStyle = 'classic' | 'hook' | 'cutout'

export const THUMBNAIL_STYLES: ThumbnailStyle[] = ['classic', 'hook', 'cutout']

export const THUMBNAIL_STYLE_LABELS: Record<ThumbnailStyle, string> = {
  classic: '정통형',
  hook: '후킹형',
  cutout: '인물컷형',
}

export interface ThumbnailCandidate {
  style: ThumbnailStyle
  url: string
  createdAt: string
}

export interface ThumbnailText {
  headline: string
  scripture: string
}

export type ThumbnailVertical = 'top' | 'middle' | 'bottom'
export type ThumbnailHorizontal = 'left' | 'center' | 'right'
export type ThumbnailPosition = `${ThumbnailVertical}-${ThumbnailHorizontal}`

export const DEFAULT_THUMBNAIL_POSITION: ThumbnailPosition = 'bottom-left'

// UI 3×3 그리드 순서(상→하, 좌→우)와 라벨.
export const THUMBNAIL_POSITIONS: ThumbnailPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

export function isThumbnailPosition(value: unknown): value is ThumbnailPosition {
  return typeof value === 'string' && (THUMBNAIL_POSITIONS as string[]).includes(value)
}
