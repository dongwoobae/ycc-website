'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Reveal from '@/components/ui/Reveal'
import SermonCard from '@/components/sermons/SermonCard'
import SermonsPagination from '@/components/sermons/SermonsPagination'
import SermonsToolbar, { type SortOrder } from '@/components/sermons/SermonsToolbar'
import { sermonListTitle } from '@/lib/sermons/list-title'
import { isPublicWorshipType, type WorshipFilterValue } from '@/lib/worship'
import type { Sermon } from '@/lib/types'

const PAGE_SIZE = 12

export default function SermonsGrid({ sermons }: { sermons: Sermon[] }) {
  const searchParams = useSearchParams()
  const worship = searchParams.get('worship')
  const selected = worship && isPublicWorshipType(worship) ? worship : undefined
  const current: WorshipFilterValue = selected ?? '전체'
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOrder>('newest')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (selected ? sermons.filter((s) => s.worshipType === selected) : sermons).filter(
      (s) => !q || sermonListTitle(s).toLowerCase().includes(q) || (s.summary ?? '').toLowerCase().includes(q)
    )
    return [...list].sort((a, b) =>
      sort === 'newest' ? b.sermonDate.localeCompare(a.sermonDate) : a.sermonDate.localeCompare(b.sermonDate)
    )
  }, [sermons, selected, query, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => setPage(1), [selected, query, sort])
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <SermonsToolbar current={current} query={query} onQuery={setQuery} sort={sort} onSort={setSort} />
      {pageItems.length === 0 ? (
        <p className="py-16 text-center text-ink-muted">검색 결과가 없습니다.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((sermon, i) => (
            <Reveal key={sermon.id} variant="fade-up" delay={(i % 3) * 90}>
              <SermonCard sermon={sermon} />
            </Reveal>
          ))}
        </div>
      )}
      <SermonsPagination page={page} totalPages={totalPages} onChange={setPage} />
    </>
  )
}
