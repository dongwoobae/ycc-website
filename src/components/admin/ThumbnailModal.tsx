'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { composeAndApplyThumbnailAction, resetThumbnailAction } from '@/lib/actions/thumbnails'
import {
  THUMBNAIL_STYLES,
  THUMBNAIL_STYLE_LABELS,
  type ThumbnailRenderOptions,
  type ThumbnailStyle,
  type ThumbnailText,
} from '@/lib/thumbnails/types'
import ThumbnailStyleTab from './ThumbnailStyleTab'

const DESCRIPTIONS: Record<ThumbnailStyle, string> = {
  classic: '설교 제목 + 성경구절을 단정하게 배치합니다.',
  hook: 'AI가 만든 짧은 헤드라인 + 성경구절로 클릭을 유도합니다.',
  cutout: '제목·구절에 더해 유튜브 썸네일에서 인물을 따내 합성합니다. (준비 중)',
}

interface Props {
  sermonId: string
  backgrounds: Partial<Record<ThumbnailStyle, string>>
  onClose: () => void
}

export default function ThumbnailModal({ sermonId, backgrounds, onClose }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<ThumbnailStyle>('classic')
  const [pending, start] = useTransition()

  function apply(text: ThumbnailText, options: ThumbnailRenderOptions) {
    start(async () => {
      await composeAndApplyThumbnailAction(sermonId, tab, text, options)
      router.refresh()
      onClose()
    })
  }

  function reset() {
    start(async () => {
      await resetThumbnailAction(sermonId)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-paper p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">썸네일 생성</h2>
          <button type="button" onClick={onClose} className="text-ink-muted">
            ✕
          </button>
        </div>
        <div className="mb-4 flex gap-2 border-b border-line">
          {THUMBNAIL_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={`px-3 py-2 text-sm font-semibold ${
                tab === s ? 'border-b-2 border-accent text-accent-deep' : 'text-ink-muted'
              }`}
            >
              {THUMBNAIL_STYLE_LABELS[s]}
            </button>
          ))}
        </div>
        <ThumbnailStyleTab
          key={tab}
          sermonId={sermonId}
          style={tab}
          description={DESCRIPTIONS[tab]}
          background={backgrounds[tab]}
          onApply={apply}
          applying={pending}
        />
        <div className="mt-6 border-t border-line pt-4">
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="text-sm text-ink-muted underline disabled:opacity-50"
          >
            유튜브 썸네일로 되돌리기
          </button>
        </div>
      </div>
    </div>
  )
}
