'use client'

import { THUMBNAIL_POSITIONS, type ThumbnailPosition } from '@/lib/thumbnails/types'

interface Props {
  value: ThumbnailPosition
  onChange: (position: ThumbnailPosition) => void
  disabled?: boolean
}

const LABELS: Record<ThumbnailPosition, string> = {
  'top-left': '좌상', 'top-center': '상', 'top-right': '우상',
  'middle-left': '좌', 'middle-center': '중앙', 'middle-right': '우',
  'bottom-left': '좌하', 'bottom-center': '하', 'bottom-right': '우하',
}

export default function ThumbnailPositionGrid({ value, onChange, disabled }: Props) {
  return (
    <div>
      <p className="mb-1 text-xs text-ink-muted">문구 위치</p>
      <div className="grid w-32 grid-cols-3 gap-1">
        {THUMBNAIL_POSITIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            disabled={disabled}
            onClick={() => onChange(pos)}
            aria-pressed={value === pos}
            className={`aspect-square rounded text-[10px] font-semibold disabled:opacity-50 ${
              value === pos
                ? 'bg-accent-deep text-white'
                : 'border border-line text-ink-muted hover:border-accent'
            }`}
          >
            {LABELS[pos]}
          </button>
        ))}
      </div>
    </div>
  )
}
