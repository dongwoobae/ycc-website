import Link from 'next/link'
import type { WorshipFilterValue } from '@/lib/worship'

interface Props {
  current: WorshipFilterValue
  basePath: string
  pills: readonly { label: string; value: WorshipFilterValue }[]
}

export default function WorshipFilter({ current, basePath, pills }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((item) => {
        const active = item.value === current
        const href = item.value === '전체' ? basePath : `${basePath}?worship=${encodeURIComponent(item.value)}`
        return (
          <Link
            key={item.value}
            href={href}
            className={`rounded-full border px-5 py-2.5 text-[14.5px] font-bold transition ${
              active
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-paper text-ink-muted hover:border-accent'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
