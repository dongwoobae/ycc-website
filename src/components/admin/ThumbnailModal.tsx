'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  applyCandidateThumbnailAction,
  composeAndApplyThumbnailAction,
  resetThumbnailAction,
  type ThumbnailActionResult,
} from '@/lib/actions/thumbnails'
import {
  THUMBNAIL_STYLES,
  THUMBNAIL_STYLE_LABELS,
  type ThumbnailCandidate,
  type ThumbnailRenderOptions,
  type ThumbnailStyle,
  type ThumbnailText,
} from '@/lib/thumbnails/types'
import ThumbnailRecentCandidates from './ThumbnailRecentCandidates'
import ThumbnailStyleTab from './ThumbnailStyleTab'

const DESCRIPTIONS: Record<ThumbnailStyle, string> = {
  classic: '설교 제목 + 성경구절을 단정하게 배치합니다.',
  hook: 'AI가 만든 짧은 헤드라인 + 성경구절로 클릭을 유도합니다.',
  cutout: '제목·구절에 더해 유튜브 썸네일에서 인물을 따내 합성합니다.',
}

interface Props {
  sermonId: string
  backgrounds: Partial<Record<ThumbnailStyle, string>>
  cutoutUrl?: string
  candidates: ThumbnailCandidate[]
  texts: Partial<Record<ThumbnailStyle, ThumbnailText>>
  appliedThumbnailUrl?: string
  onClose: () => void
}

export default function ThumbnailModal({
  sermonId,
  backgrounds,
  cutoutUrl,
  candidates,
  texts,
  appliedThumbnailUrl,
  onClose,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<ThumbnailStyle>('classic')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  // 예상 가능한 실패는 액션 반환값(error)으로 구체적 메시지를 보여주고, 예상 밖 throw 는
  // 에러 바운더리로 페이지가 튕기지 않게 잡아 고정 문구로 안내한다(상세는 서버 로그 digest).
  function run(action: () => Promise<ThumbnailActionResult>, failMessage: string) {
    setError('')
    start(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          setError(result.error)
          return
        }
        router.refresh()
        onClose()
      } catch {
        setError(failMessage)
      }
    })
  }

  function apply(text: ThumbnailText, options: ThumbnailRenderOptions) {
    run(() => composeAndApplyThumbnailAction(sermonId, tab, text, options), '썸네일 적용에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }

  function applyCandidate(url: string) {
    run(() => applyCandidateThumbnailAction(sermonId, url), '생성본 적용에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }

  function reset() {
    run(() => resetThumbnailAction(sermonId), '되돌리기에 실패했습니다. 잠시 후 다시 시도해주세요.')
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
        {THUMBNAIL_STYLES.map((s) => (
          <div key={s} className={tab === s ? '' : 'hidden'}>
            <ThumbnailStyleTab
              sermonId={sermonId}
              style={s}
              description={DESCRIPTIONS[s]}
              background={backgrounds[s]}
              cutout={cutoutUrl}
              initialText={texts[s]}
              onApply={apply}
              applying={pending}
            />
          </div>
        ))}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <ThumbnailRecentCandidates
          candidates={candidates}
          appliedUrl={appliedThumbnailUrl}
          disabled={pending}
          onApply={applyCandidate}
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
