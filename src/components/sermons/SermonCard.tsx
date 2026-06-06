import Link from 'next/link'

interface SermonCardProps {
  id: string
  title: string
  preacher: string
  scripture?: string
  worshipType: string
  sermonDate: string
  thumbnailUrl?: string
}

export default function SermonCard({
  id,
  title,
  preacher,
  scripture,
  worshipType,
  sermonDate,
  thumbnailUrl,
}: SermonCardProps) {
  return (
    <Link
      href={`/sermons/${id}`}
      className="block overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="flex h-40 w-full items-center justify-center bg-gray-200 text-sm text-gray-400">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          '썸네일'
        )}
      </div>
      <div className="p-4">
        <span className="text-xs font-medium text-blue-600">{worshipType}</span>
        <h3 className="mt-1 line-clamp-2 font-semibold text-gray-900">{title}</h3>
        {scripture && <p className="mt-1 text-xs text-gray-500">{scripture}</p>}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span>{preacher}</span>
          <span>{sermonDate}</span>
        </div>
      </div>
    </Link>
  )
}
