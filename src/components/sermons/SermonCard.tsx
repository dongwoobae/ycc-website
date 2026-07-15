import Image from 'next/image'
import Link from 'next/link'
import { sermonListTitle } from '@/lib/sermons/list-title'
import type { Sermon } from '@/lib/types'

export default function SermonCard({ sermon }: { sermon: Sermon }) {
  const title = sermonListTitle(sermon)
  return (
    <Link
      href={`/sermons/${sermon.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle transition hover:-translate-y-1 hover:shadow-lifted"
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
            <div className="flex h-full w-full items-center justify-center bg-accent-deep p-6 text-center">
              <p className="line-clamp-3 text-[clamp(17px,1.8vw,22px)] font-extrabold leading-[1.5] text-white">
                {title}
              </p>
            </div>
          )}
        </div>
        <span className="absolute -bottom-[22px] right-3.5 z-[3] flex h-[46px] w-[46px] items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_22px_rgb(33_83_180/0.45)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
      <div className="px-6 pb-6 pt-7">
        <div className="flex items-center justify-between gap-3 text-[13px] font-semibold text-accent">
          <span>{sermon.worshipType === '미분류' ? '' : sermon.worshipType}</span>
          <time dateTime={sermon.sermonDate}>{sermon.sermonDate}</time>
        </div>
        <h3 className="mt-3 line-clamp-2 text-xl font-extrabold leading-snug tracking-tight text-ink">
          {title}
        </h3>
        {sermon.summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-muted">{sermon.summary}</p>
        ) : null}
      </div>
    </Link>
  )
}
