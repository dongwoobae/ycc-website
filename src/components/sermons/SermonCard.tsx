import Image from 'next/image'
import Link from 'next/link'
import { sermonListTitle } from '@/lib/sermons/list-title'
import type { Sermon } from '@/lib/types'

export default function SermonCard({ sermon }: { sermon: Sermon }) {
  const title = sermonListTitle(sermon)
  return (
    <Link
      href={`/sermons/${sermon.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle transition hover:-translate-y-1 hover:border-accent hover:shadow-soft"
    >
      <div className="relative">
        <div className="relative aspect-video overflow-hidden bg-surface">
          {sermon.thumbnailUrl ? (
            <Image
              src={sermon.thumbnailUrl}
              alt={`${title} 설교 썸네일`}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,rgb(var(--surface)),rgb(var(--paper)))]" />
          )}
        </div>
        <span className="absolute -bottom-[22px] right-3.5 z-[3] flex h-[46px] w-[46px] items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_22px_-8px_var(--color-accent)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
      <div className="px-6 pb-6 pt-7">
        <div className="flex items-center justify-between gap-3 text-[13px] font-semibold text-accent-deep">
          <span>{sermon.worshipType === '미분류' ? '' : sermon.worshipType}</span>
          <time dateTime={sermon.sermonDate}>{sermon.sermonDate}</time>
        </div>
        <h3 className="mt-3 line-clamp-2 font-serif text-xl font-extrabold leading-snug tracking-tight text-ink">
          {title}
        </h3>
        {sermon.summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-muted">{sermon.summary}</p>
        ) : null}
      </div>
    </Link>
  )
}
