import Image from 'next/image'
import Link from 'next/link'
import type { Sermon } from '@/lib/types'

export default function SermonPlayCard({ sermon }: { sermon: Sermon }) {
  return (
    <Link
      href={`/sermons/${sermon.id}`}
      className="motion-hover group block h-full overflow-hidden rounded-[18px] border border-line bg-paper transition hover:-translate-y-1 hover:border-accent"
    >
      <div className="relative h-[175px] overflow-hidden bg-surface">
        {sermon.thumbnailUrl ? (
          <Image
            src={sermon.thumbnailUrl}
            alt={`${sermon.title} 설교 썸네일`}
            fill
            sizes="(min-width: 960px) 33vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,rgb(var(--surface)),rgb(var(--paper)))]" />
        )}
        <span className="absolute -bottom-5 right-4 flex h-[46px] w-[46px] items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_22px_-8px_rgb(var(--accent))]">
          <span className="ml-0.5 text-lg" aria-hidden>
            ▶
          </span>
        </span>
      </div>
      <div className="p-6 pt-8">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-accent">
          <span>{sermon.worshipType}</span>
          <time dateTime={sermon.sermonDate}>{sermon.sermonDate}</time>
        </div>
        <h3 className="mt-3 line-clamp-2 font-serif text-[21px] font-extrabold leading-snug tracking-tight text-ink">
          {sermon.title}
        </h3>
        {sermon.summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-muted">{sermon.summary}</p>
        ) : null}
      </div>
    </Link>
  )
}
