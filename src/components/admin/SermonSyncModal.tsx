'use client'

import type { SyncPhase, SyncProgressState } from './useSermonSync'

interface Props {
  phase: SyncPhase
  progress: SyncProgressState
  doneMsg: string
  onStart: () => void
  onClose: () => void
}

export default function SermonSyncModal({ phase, progress, doneMsg, onStart, onClose }: Props) {
  if (phase === 'idle') return null
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-paper shadow-2xl">
        <div className="flex h-11 items-center justify-between bg-accent-deep px-5 text-white">
          <h3 className="text-sm font-semibold">설교 동기화</h3>
          {phase !== 'progress' && (
            <button type="button" onClick={onClose} aria-label="닫기" className="text-white/80 hover:text-white">
              ✕
            </button>
          )}
        </div>

        <div className="space-y-4 p-5 text-sm">
          {phase === 'confirm' && (
            <>
              <p className="leading-6 text-ink">
                YouTube 채널에서 새 영상만 가져와 즉시 공개 등록합니다. 예배(주일·수요·금요·찬양)는 자막이 있으면 요약까지
                자동 생성돼요. 진행 중에는 창을 닫지 마세요.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2 text-ink-muted">
                  취소
                </button>
                <button
                  type="button"
                  onClick={onStart}
                  className="rounded-md bg-accent-deep px-4 py-2 font-semibold text-white"
                >
                  시작
                </button>
              </div>
            </>
          )}

          {phase === 'progress' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">{progress.phase || '처리 중...'}</span>
                <span className="text-ink-muted">
                  {progress.total > 0 ? `${progress.current} / ${progress.total}건` : ''}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-2 rounded-full bg-accent-deep transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {progress.title && <p className="truncate text-ink-muted">{progress.title}</p>}
              <p className="text-center text-xs text-ink-muted">진행 중에는 창을 닫지 마세요.</p>
            </div>
          )}

          {phase === 'done' && (
            <>
              <p className="text-ink">{doneMsg}</p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-accent-deep px-4 py-2 font-semibold text-white"
                >
                  확인
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
