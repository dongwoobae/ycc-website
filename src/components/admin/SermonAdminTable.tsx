'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { togglePublishAction } from '@/lib/actions/sermons'
import { sermonListTitle } from '@/lib/sermons/list-title'
import { worshipTypes } from '@/lib/worship'
import { useSermonSync } from './useSermonSync'
import SermonSyncModal from './SermonSyncModal'

interface Row {
  id: string
  sermonDate: string
  title: string
  displayTitle: string | null
  preacher: string | null
  worshipType: string
  isPublished: boolean
  summaryStatus: string
  hasCustomThumbnail: boolean
}

function ThumbnailBadge({ custom }: { custom: boolean }) {
  return custom ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      생성됨
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted">
      YouTube
    </span>
  )
}

// 요약 상태별 원형 표시. DB 값은 none/pending/ready/failed.
const SUMMARY_META: Record<string, { color: string; label: string }> = {
  ready: { color: '#16a34a', label: '완료' },
  pending: { color: '#92633a', label: '대기' },
  none: { color: '#9ca3af', label: '없음' },
  failed: { color: '#dc2626', label: '실패' },
}

// 정렬 우선순위(작을수록 위). 첫 클릭: failed→none→pending→ready 순.
const SORT_RANK: Record<string, number> = { failed: 0, none: 1, pending: 2, ready: 3 }

// 0: 초기(날짜순) · 1: 오름차순(failed 위) · 2: 내림차순(ready 위)
type SortState = 0 | 1 | 2

function SummaryBadge({ status }: { status: string }) {
  const meta = SUMMARY_META[status] ?? SUMMARY_META.none
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
      <span className="text-ink-muted">{meta.label}</span>
    </span>
  )
}

export default function SermonAdminTable({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')
  const sync = useSermonSync()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState>(0)
  const [worshipFilter, setWorshipFilter] = useState('전체')

  // 데이터에 실제 존재하는 예배 종류만 노출 — 표준 순서 우선, 그 외(미분류 등)는 뒤에.
  const present = Array.from(new Set(rows.map((row) => row.worshipType)))
  const worshipOptions = [
    ...worshipTypes.filter((type) => present.includes(type)),
    ...present.filter((type) => !(worshipTypes as readonly string[]).includes(type)),
  ]

  const q = query.trim().toLowerCase()
  const filtered = rows.filter((row) => {
    if (q && !sermonListTitle(row).toLowerCase().includes(q)) return false
    if (worshipFilter !== '전체' && row.worshipType !== worshipFilter) return false
    return true
  })

  const sorted =
    sort === 0
      ? filtered
      : [...filtered].sort((a, b) => {
          const d = (SORT_RANK[a.summaryStatus] ?? 99) - (SORT_RANK[b.summaryStatus] ?? 99)
          return sort === 1 ? d : -d
        })

  const sortIndicator = sort === 0 ? '↕' : sort === 1 ? '↑' : '↓'

  function run(fn: () => Promise<unknown>, ok: string) {
    setMsg('')
    startTransition(async () => {
      try {
        await fn()
        setMsg(ok)
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          title="YouTube 채널에서 새 영상만 가져와 즉시 공개 등록합니다. 예배(주일·수요·금요·찬양)는 자막 요약까지 자동 생성됩니다."
          onClick={sync.open}
          className="rounded-md bg-accent-deep px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          지금 동기화
        </button>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="제목 검색"
          aria-label="설교 제목 검색"
          className="w-48 rounded-md border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        {msg && <span className="text-sm text-ink-muted">{msg}</span>}
      </div>
      <p className="mb-4 text-xs leading-5 text-ink-muted">
        <strong className="font-semibold text-ink">지금 동기화</strong> — YouTube 채널에서 새 영상만 가져와 즉시 공개
        등록합니다. 예배(주일·수요·금요·찬양)는 자막이 있으면 요약까지 자동 생성돼요. 기존 설교는 변경되지 않습니다.
      </p>
      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[44rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['Date', 'Title', 'Preacher'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-medium">
                <select
                  value={worshipFilter}
                  onChange={(event) => setWorshipFilter(event.target.value)}
                  aria-label="예배 종류로 필터"
                  title="예배 종류로 필터"
                  className={`cursor-pointer bg-transparent font-medium hover:text-ink focus:outline-none ${
                    worshipFilter !== '전체' ? 'text-ink' : ''
                  }`}
                >
                  <option value="전체">Worship</option>
                  {worshipOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-4 py-3 text-left font-medium">Thumbnail</th>
              <th className="px-4 py-3 text-left font-medium">
                <button
                  type="button"
                  onClick={() => setSort((s) => ((s + 1) % 3) as SortState)}
                  className="inline-flex items-center gap-1 font-medium hover:text-ink"
                  title="클릭하여 요약 상태로 정렬"
                >
                  Summary <span className="text-xs">{sortIndicator}</span>
                </button>
              </th>
              {['Published', 'Actions'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr className="border-t border-line">
                <td className="px-4 py-3 text-ink-muted" colSpan={8}>
                  {rows.length === 0 ? 'No sermons.' : '검색 결과가 없습니다.'}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const listTitle = sermonListTitle(row)
                return (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-4 py-3 whitespace-nowrap">{row.sermonDate}</td>
                    <td className="max-w-[14rem] px-4 py-3">
                      <Link
                        href={`/admin/sermons/${row.id}/edit`}
                        title={listTitle}
                        className="block truncate text-accent-deep hover:underline"
                      >
                        {listTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.preacher ?? '—'}</td>
                    <td className="px-4 py-3">{row.worshipType}</td>
                    <td className="px-4 py-3">
                      <ThumbnailBadge custom={row.hasCustomThumbnail} />
                    </td>
                    <td className="px-4 py-3">
                      <SummaryBadge status={row.summaryStatus} />
                    </td>
                    <td className="px-4 py-3">{row.isPublished ? '공개' : '비공개'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/admin/sermons/${row.id}/edit`} className="text-accent-deep hover:underline">
                          편집
                        </Link>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => togglePublishAction(row.id, !row.isPublished), '변경됨')}
                          className="text-accent-deep hover:underline disabled:opacity-50"
                        >
                          {row.isPublished ? '비공개' : '공개'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <SermonSyncModal
        phase={sync.phase}
        progress={sync.progress}
        doneMsg={sync.doneMsg}
        onStart={sync.start}
        onClose={sync.close}
      />
    </div>
  )
}
