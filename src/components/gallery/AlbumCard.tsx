import Link from 'next/link'
import type { GalleryAlbum } from '@/lib/types'

export default function AlbumCard({ album }: { album: GalleryAlbum }) {
  return (
    <Link
      href={`/gallery/${album.id}`}
      className="group block overflow-hidden rounded-lg border border-line bg-paper shadow-subtle transition hover:-translate-y-1 hover:shadow-soft"
    >
      <div className="aspect-[4/3] overflow-hidden bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={album.coverImgUrl}
          alt={album.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-5">
        <time className="text-sm font-medium text-accent" dateTime={album.eventDate}>
          {album.eventDate}
        </time>
        <h3 className="mt-2 font-serif text-xl text-ink">{album.title}</h3>
        {album.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-muted">{album.description}</p>}
      </div>
    </Link>
  )
}
