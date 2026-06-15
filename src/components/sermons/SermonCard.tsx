import Link from 'next/link'
import type { Sermon } from '@/lib/types'

export default function SermonCard({ sermon }: { sermon: Sermon }) {
  return (
    <Link
      href={`/sermons/${sermon.id}`}
      className="group block overflow-hidden rounded-lg border border-line bg-paper shadow-subtle transition hover:-translate-y-1 hover:shadow-soft"
    >
      <div className="aspect-video overflow-hidden bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sermon.thumbnailUrl}
          alt={`${sermon.title} 설교 썸네일`}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-accent-deep">
          <span>{sermon.worshipType}</span>
          <time dateTime={sermon.sermonDate}>{sermon.sermonDate}</time>
        </div>
        <h3 className="mt-3 line-clamp-2 font-serif text-xl font-extrabold leading-snug tracking-tight text-ink">
          {sermon.title}
        </h3>
        <p className="mt-3 text-sm text-ink-muted">{sermon.preacher}</p>
        {sermon.scripture && <p className="mt-1 text-sm text-ink-muted">{sermon.scripture}</p>}
      </div>
    </Link>
  )
}
