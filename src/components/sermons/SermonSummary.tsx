'use client'

import { useCallback, useRef, useState } from 'react'
import YouTubePlayer from './YouTubePlayer'
import { useStickyVideoBleed } from './useStickyVideoBleed'
import { formatTimestamp } from '@/lib/sermons/format'
import { sermonListTitle } from '@/lib/sermons/list-title'
import type { Sermon } from '@/lib/types'
import { expectsAutoSummary } from '@/lib/worship'

export function isSummaryInProgress(sermon: Pick<Sermon, 'summaryStatus' | 'worshipType'>): boolean {
  return (sermon.summaryStatus === 'none' || sermon.summaryStatus === 'pending') && expectsAutoSummary(sermon.worshipType)
}

export default function SermonSummary({ sermon }: { sermon: Sermon }) {
  const seekRef = useRef<((seconds: number) => void) | null>(null)
  const [engaged, setEngaged] = useState(false)
  const handleEngaged = useCallback(() => setEngaged(true), [])
  const { sentinelRef, videoRef, frameRef } = useStickyVideoBleed(engaged)
  const ready = sermon.summaryStatus === 'ready'
  const inProgress = isSummaryInProgress(sermon)
  const hasSummary = ready && Boolean(sermon.quickSummary?.length || sermon.chapters?.length)
  const header = (
    <header>
      {sermon.worshipType !== '미분류' ? (
        <p className="text-sm font-semibold text-accent-deep">{sermon.worshipType}</p>
      ) : null}
      <h1 className="mt-3 font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
        {sermonListTitle(sermon)}
      </h1>
      <p className="mt-4 text-ink-muted">{sermon.sermonDate}</p>
      {sermon.summary ? (
        <p className="mt-4 max-w-3xl leading-7 text-ink-muted">{sermon.summary}</p>
      ) : null}
    </header>
  )

  if (!hasSummary) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        {header}
        <YouTubePlayer youtubeId={sermon.youtubeId} title={sermon.title} seekToRef={seekRef} />
        {inProgress ? (
          <section className="rounded-lg border border-line bg-paper p-6 text-ink-muted shadow-subtle">
            <p className="leading-7">설교 요약 준비중...</p>
          </section>
        ) : null}
      </div>
    )
  }

  return (
    <div className="lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-10">
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
        </div>
      </div>

      <div className="mt-8 space-y-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-14">
        {ready && sermon.quickSummary?.length ? (
          <section className="rounded-lg border border-line bg-paper p-6 shadow-subtle">
            <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">빠른 요약</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-ink-muted">
              {sermon.quickSummary.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {ready && sermon.chapters?.length ? (
          <section className="rounded-lg border border-line bg-paper p-6 shadow-subtle">
            <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">타임라인 요약</h2>
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
                    className="font-mono text-sm font-semibold text-accent-deep hover:underline"
                  >
                    {formatTimestamp(chapter.startSeconds)}
                  </button>
                  <p className="mt-1 font-semibold text-ink">{chapter.title}</p>
                  <p className="mt-1 leading-7 text-ink-muted">{chapter.summary}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
