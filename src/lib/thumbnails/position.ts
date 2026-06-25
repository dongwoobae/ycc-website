import type { ThumbnailHorizontal, ThumbnailPosition, ThumbnailVertical } from './types'

const VERTICAL: Record<ThumbnailVertical, 'flex-start' | 'center' | 'flex-end'> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
}

const HORIZONTAL: Record<ThumbnailHorizontal, 'flex-start' | 'center' | 'flex-end'> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

const TEXT_ALIGN: Record<ThumbnailHorizontal, 'left' | 'center' | 'right'> = {
  left: 'left',
  center: 'center',
  right: 'right',
}

export interface ThumbnailLayout {
  justifyContent: 'flex-start' | 'center' | 'flex-end'
  alignItems: 'flex-start' | 'center' | 'flex-end'
  textAlign: 'left' | 'center' | 'right'
}

/** 9분할 위치를 flex(세로=justifyContent, 가로=alignItems) + textAlign으로 변환. */
export function positionToLayout(position: ThumbnailPosition): ThumbnailLayout {
  const [vertical, horizontal] = position.split('-') as [ThumbnailVertical, ThumbnailHorizontal]
  return {
    justifyContent: VERTICAL[vertical],
    alignItems: HORIZONTAL[horizontal],
    textAlign: TEXT_ALIGN[horizontal],
  }
}
