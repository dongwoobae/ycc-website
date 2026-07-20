'use client'

import { useCallback, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import YouTubePlayer from './YouTubePlayer'
import { useStickyVideoBleed } from './useStickyVideoBleed'
import { formatTimestamp } from '@/lib/sermons/format'
import { sermonListTitle } from '@/lib/sermons/list-title'
import type { Sermon } from '@/lib/types'
import { expectsAutoSummary } from '@/lib/worship'

export function isSummaryInProgress(sermon: Pick<Sermon, 'summaryStatus' | 'worshipType'>): boolean {
  return (sermon.summaryStatus === 'none' || sermon.summaryStatus === 'pending') && expectsAutoSummary(sermon.worshipType)
}

export const SUMMARY_FONT_SIZES = ['1.25rem', '1.5rem', '1.75rem'] as const
const FONT_LEVEL_STORAGE_KEY = 'sermon-summary-font-level'
const FONT_LEVEL_EVENT = 'sermon-summary-font-level-change'

function subscribeFontLevel(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(FONT_LEVEL_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(FONT_LEVEL_EVENT, onChange)
  }
}

function readFontLevel(): number {
  try {
    const stored = window.localStorage.getItem(FONT_LEVEL_STORAGE_KEY)
    return stored === null ? 0 : clampFontLevel(Number(stored))
  } catch {
    return 0
  }
}

export function clampFontLevel(value: number): number {
  if (!Number.isInteger(value)) return 0
  return Math.min(Math.max(value, 0), SUMMARY_FONT_SIZES.length - 1)
}

// 본문 글자만 --summary-fs로 확대하고 행간은 비례(leading-relaxed)로 따라가게 한다
const summaryTextClass = 'text-[length:var(--summary-fs,1.25rem)] leading-relaxed'

function FontSizeControl({
  level,
  onChange,
  className,
}: {
  level: number
  onChange: (level: number) => void
  className?: string
}) {
  return (
    <div role="group" aria-label="요약 글자 크기 조절" className={`items-center gap-2 ${className ?? 'flex'}`}>
      <button
        type="button"
        onClick={() => onChange(level - 1)}
        disabled={level <= 0}
        aria-label="글자 작게"
        className="h-10 w-10 rounded-lg border border-line bg-paper text-sm font-semibold text-ink shadow-subtle transition hover:bg-line/40 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-paper"
      >
        가−
      </button>
      <button
        type="button"
        onClick={() => onChange(level + 1)}
        disabled={level >= SUMMARY_FONT_SIZES.length - 1}
        aria-label="글자 크게"
        className="h-10 w-10 rounded-lg border border-line bg-paper text-lg font-semibold text-ink shadow-subtle transition hover:bg-line/40 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-paper"
      >
        가＋
      </button>
    </div>
  )
}

export default function SermonSummary({ sermon }: { sermon: Sermon }) {
  const seekRef = useRef<((seconds: number) => void) | null>(null)
  const [engaged, setEngaged] = useState(false)
  const handleEngaged = useCallback(() => setEngaged(true), [])
  const { sentinelRef, videoRef, frameRef } = useStickyVideoBleed(engaged)
  const fontLevel = useSyncExternalStore(subscribeFontLevel, readFontLevel, () => 0)
  const changeFontLevel = useCallback((next: number) => {
    try {
      window.localStorage.setItem(FONT_LEVEL_STORAGE_KEY, String(clampFontLevel(next)))
    } catch {
      return
    }
    window.dispatchEvent(new Event(FONT_LEVEL_EVENT))
  }, [])
  const fontStyle = { '--summary-fs': SUMMARY_FONT_SIZES[fontLevel] } as CSSProperties
  const ready = sermon.summaryStatus === 'ready'
  const inProgress = isSummaryInProgress(sermon)
  const hasSummary = ready && Boolean(sermon.quickSummary?.length || sermon.chapters?.length)
  const header = (
    <header>
      {sermon.worshipType !== '미분류' ? (
        <p className="text-sm font-semibold text-accent-deep">{sermon.worshipType}</p>
      ) : null}
      <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
        {sermonListTitle(sermon)}
      </h1>
      <p className="mt-4 text-ink-muted">{sermon.sermonDate}</p>
      {sermon.summary ? (
        <p className={`mt-4 max-w-3xl text-ink ${summaryTextClass}`}>{sermon.summary}</p>
      ) : null}
    </header>
  )

  if (!hasSummary) {
    return (
      <div className="mx-auto max-w-5xl space-y-8" style={fontStyle}>
        {header}
        <YouTubePlayer youtubeId={sermon.youtubeId} title={sermon.title} seekToRef={seekRef} />
        {inProgress ? (
          <section className="rounded-lg border border-line bg-paper p-6 text-ink-muted shadow-subtle">
            <p className={summaryTextClass}>설교 요약 준비중...</p>
          </section>
        ) : null}
      </div>
    )
  }

  return (
    <div className="lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-10" style={fontStyle}>
      <div className="lg:col-start-1 lg:row-start-1">{header}</div>

      <div ref={sentinelRef} aria-hidden className="mt-8 h-0 lg:hidden" />

      <div
        ref={videoRef}
        className={`${engaged ? 'sticky top-20 z-30 ' : ''}lg:static lg:col-start-1 lg:row-start-2 lg:mt-[var(--sermon-video-offset)] lg:min-h-[calc(100vh-2rem)] lg:[--sermon-video-offset:calc((((min(100vw,1600px)-4rem-2.5rem)/2)*9/32)+2rem)]`}
      >
        <div className="lg:sticky lg:top-[50vh] lg:z-10 lg:-translate-y-1/2">
          <YouTubePlayer
            youtubeId={sermon.youtubeId}
            title={sermon.title}
            seekToRef={seekRef}
            rootRef={frameRef}
            onEngaged={handleEngaged}
          />
          <FontSizeControl level={fontLevel} onChange={changeFontLevel} className="mt-4 hidden justify-end lg:flex" />
        </div>
      </div>

      <FontSizeControl
        level={fontLevel}
        onChange={changeFontLevel}
        className="fixed bottom-4 right-4 z-40 flex lg:hidden"
      />

      <div className="mt-8 space-y-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-14">
        {ready && sermon.quickSummary?.length ? (
          <section className="rounded-lg border border-line bg-paper p-6 shadow-subtle">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">빠른 요약</h2>
            <ul className={`mt-4 list-disc space-y-2 pl-5 text-ink ${summaryTextClass}`}>
              {sermon.quickSummary.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {ready && sermon.chapters?.length ? (
          <section className="rounded-lg border border-line bg-paper p-6 shadow-subtle">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">타임라인 요약</h2>
            <div className="mt-4">
              {sermon.chapters.map((chapter, i) => (
                <div key={i}>
                  {i > 0 ? (
                    <>
                      <br />
                      <br />
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => seekRef.current?.(chapter.startSeconds)}
                    className="font-mono text-base font-semibold text-accent-deep hover:underline"
                  >
                    {formatTimestamp(chapter.startSeconds)}
                  </button>
                  <p className={`mt-1 font-semibold text-ink ${summaryTextClass}`}>{chapter.title}</p>
                  <p className={`mt-1 text-ink ${summaryTextClass}`}>{chapter.summary}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
