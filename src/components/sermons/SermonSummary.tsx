'use client'

import { useRef } from 'react'
import YouTubePlayer from './YouTubePlayer'
import { formatTimestamp } from '@/lib/sermons/format'
import type { Sermon } from '@/lib/types'
import { expectsAutoSummary } from '@/lib/worship'

export function isSummaryInProgress(sermon: Pick<Sermon, 'summaryStatus' | 'worshipType'>): boolean {
  return (sermon.summaryStatus === 'none' || sermon.summaryStatus === 'pending') && expectsAutoSummary(sermon.worshipType)
}

export default function SermonSummary({ sermon }: { sermon: Sermon }) {
  const seekRef = useRef<((seconds: number) => void) | null>(null)
  const ready = sermon.summaryStatus === 'ready'
  const inProgress = isSummaryInProgress(sermon)

  return (
    <div className="mt-8 space-y-8">
      <YouTubePlayer youtubeId={sermon.youtubeId} title={sermon.title} seekToRef={seekRef} />

      {inProgress ? (
        <section className="rounded-lg border border-line bg-paper p-6 text-ink-muted shadow-subtle">
          <p className="leading-7">설교 요약 대기중..</p>
        </section>
      ) : null}

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
  )
}
