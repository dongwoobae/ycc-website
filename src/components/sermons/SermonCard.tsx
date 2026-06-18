import Link from 'next/link'
import type { Sermon } from '@/lib/types'

export default function SermonCard({ sermon }: { sermon: Sermon }) {
  return (
    <Link
      href={`/sermons/${sermon.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle transition hover:-translate-y-1 hover:border-accent hover:shadow-soft"
    >
      <div className="relative">
        <div className="aspect-video overflow-hidden bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sermon.thumbnailUrl}
            alt={`${sermon.title} 설교 썸네일`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>
        <span className="absolute -bottom-[22px] right-3.5 z-[3] flex h-[46px] w-[46px] items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_22px_-8px_var(--color-accent)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
      <div className="px-6 pb-6 pt-7">
        <div className="flex items-center justify-between gap-3 text-[13px] font-semibold text-accent-deep">
          <span>{sermon.worshipType}</span>
          <time dateTime={sermon.sermonDate}>{sermon.sermonDate}</time>
        </div>
        <h3 className="mt-3 line-clamp-2 font-serif text-xl font-extrabold leading-snug tracking-tight text-ink">
          {sermon.title}
        </h3>
        <p className="mt-2 text-sm text-faint">
          {sermon.preacher}
          {sermon.scripture ? ` · ${sermon.scripture}` : ''}
        </p>
      </div>
    </Link>
  )
}
