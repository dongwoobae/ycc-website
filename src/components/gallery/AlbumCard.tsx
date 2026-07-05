import Image from 'next/image'
import Link from 'next/link'
import type { GalleryAlbum } from '@/lib/types'

export default function AlbumCard({ album }: { album: GalleryAlbum }) {
  const photoCount = album.imageCount ?? album.images.length

  return (
    <Link
      href={`/gallery/${album.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle transition hover:-translate-y-1 hover:shadow-lifted"
    >
      <div className="relative">
        <div className="relative aspect-[4/3] overflow-hidden bg-surface">
          {album.coverImgUrl ? (
            <Image
              src={album.coverImgUrl}
              alt={album.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,rgb(var(--surface)),rgb(var(--paper)))]" />
          )}
        </div>
        {photoCount > 0 && (
          <span className="absolute right-3 top-3 z-[3] whitespace-nowrap rounded-full bg-ink/70 px-3 py-1.5 text-[12.5px] font-bold text-white backdrop-blur-sm">
            {photoCount}장
          </span>
        )}
      </div>
      <div className="px-6 pb-6 pt-5">
        <time className="text-[13px] font-semibold text-accent-deep" dateTime={album.eventDate}>
          {album.eventDate}
        </time>
        <h3 className="mt-2 font-serif text-xl font-extrabold leading-snug tracking-tight text-ink">{album.title}</h3>
        {album.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-muted">{album.description}</p>}
      </div>
    </Link>
  )
}
