'use client'

import Image from 'next/image'
import { THUMBNAIL_STYLE_LABELS, type ThumbnailCandidate } from '@/lib/thumbnails/types'

interface Props {
  candidates: ThumbnailCandidate[]
  appliedUrl?: string
  disabled: boolean
  onApply: (url: string) => void
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** 최근 생성본(최대 3건) 목록 — 클릭하면 재합성 없이 해당 본으로 즉시 되돌린다. */
export default function ThumbnailRecentCandidates({ candidates, appliedUrl, disabled, onApply }: Props) {
  if (candidates.length === 0) return null
  const recentFirst = [...candidates].reverse()

  return (
    <div className="mt-6 border-t border-line pt-4">
      <p className="mb-2 text-sm font-semibold text-ink">최근 생성본</p>
      <div className="grid grid-cols-3 gap-2">
        {recentFirst.map((candidate) => {
          const isApplied = candidate.url === appliedUrl
          return (
            <button
              key={candidate.url}
              type="button"
              disabled={disabled || isApplied}
              onClick={() => onApply(candidate.url)}
              className={`group text-left ${disabled ? 'opacity-50' : ''}`}
              title={isApplied ? '현재 적용 중' : '이 생성본으로 되돌리기'}
            >
              <div
                className={`relative aspect-video overflow-hidden rounded-md border-2 bg-surface ${
                  isApplied ? 'border-accent' : 'border-transparent group-hover:border-line'
                }`}
              >
                <Image src={candidate.url} alt="썸네일 생성본" fill sizes="10rem" className="object-cover" />
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {THUMBNAIL_STYLE_LABELS[candidate.style]} · {formatCreatedAt(candidate.createdAt)}
                {isApplied && <span className="ml-1 font-semibold text-accent-deep">적용 중</span>}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
