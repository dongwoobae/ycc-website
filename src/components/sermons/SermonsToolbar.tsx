'use client'

import WorshipFilter from '@/components/sermons/WorshipFilter'
import type { WorshipFilterValue } from '@/lib/worship'

export type SortOrder = 'newest' | 'oldest'

interface Props {
  current: WorshipFilterValue
  basePath: string
  pills: readonly { label: string; value: WorshipFilterValue }[]
  query: string
  onQuery: (value: string) => void
  sort: SortOrder
  onSort: (value: SortOrder) => void
}

export default function SermonsToolbar({ current, basePath, pills, query, onQuery, sort, onSort }: Props) {
  return (
    <div className="mb-9 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <WorshipFilter current={current} basePath={basePath} pills={pills} />
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="제목·요약 검색"
          aria-label="영상 검색"
          className="w-44 rounded-full border border-line bg-paper px-4 py-2.5 text-sm focus:border-accent focus:outline-none"
        />
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value as SortOrder)}
          aria-label="정렬 순서"
          className="rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink-muted focus:border-accent focus:outline-none"
        >
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
        </select>
      </div>
    </div>
  )
}
