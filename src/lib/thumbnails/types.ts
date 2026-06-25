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
