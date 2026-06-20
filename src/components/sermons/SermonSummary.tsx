'use client'

import { useRef } from 'react'
import YouTubePlayer from './YouTubePlayer'
import { formatTimestamp } from '@/lib/sermons/format'
import type { Sermon } from '@/lib/types'

export default function SermonSummary({ sermon }: { sermon: Sermon }) {
  const seekRef = useRef<((seconds: number) => void) | null>(null)
  const ready = sermon.summaryStatus === 'ready'

  return (
    <div className="mt-8 space-y-8">
      <YouTubePlayer youtubeId={sermon.youtubeId} title={sermon.title} seekToRef={seekRef} />

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
          <ul className="mt-4 space-y-4">
            {sermon.chapters.map((chapter, i) => (
              <li key={i} className="flex gap-3">
                <button
                  type="button"
                  onClick={() => seekRef.current?.(chapter.startSeconds)}
                  className="shrink-0 font-mono text-sm font-semibold text-accent-deep hover:underline"
                >
                  {formatTimestamp(chapter.startSeconds)}
                </button>
                <div>
                  <p className="font-semibold text-ink">{chapter.title}</p>
                  <p className="mt-1 leading-7 text-ink-muted">{chapter.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
