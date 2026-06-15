import Link from 'next/link'
import { worshipFilterItems, type WorshipFilterValue } from '@/lib/worship'

export default function WorshipFilter({ current }: { current: WorshipFilterValue }) {
  return (
    <div className="flex flex-wrap gap-2">
      {worshipFilterItems.map((item) => {
        const active = item.value === current
        const href = item.value === '전체' ? '/sermons' : `/sermons?worship=${encodeURIComponent(item.value)}`
        return (
          <Link
            key={item.value}
            href={href}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              active
                ? 'border-accent bg-accent text-bg'
                : 'border-line bg-paper text-ink-muted hover:border-accent hover:text-accent'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
