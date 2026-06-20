'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { generateSummaryAction, syncNowAction, togglePublishAction } from '@/lib/actions/sermons'

interface Row {
  id: string
  sermonDate: string
  title: string
  preacher: string | null
  worshipType: string
  isPublished: boolean
  summaryStatus: string
}

export default function SermonAdminTable({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')

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
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await syncNowAction()
              setMsg(`동기화 완료: ${result.inserted}건 추가`)
            }, '')
          }
          className="rounded-md bg-accent-deep px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          지금 동기화
        </button>
        {msg && <span className="text-sm text-ink-muted">{msg}</span>}
      </div>
      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[48rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['Date', 'Title', 'Preacher', 'Worship', 'Summary', 'Published', 'Actions'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-line">
                <td className="px-4 py-3 text-ink-muted" colSpan={7}>
                  No sermons.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">{row.sermonDate}</td>
                  <td className="px-4 py-3">{row.title}</td>
                  <td className="px-4 py-3">{row.preacher ?? '—'}</td>
                  <td className="px-4 py-3">{row.worshipType}</td>
                  <td className="px-4 py-3">{row.summaryStatus}</td>
                  <td className="px-4 py-3">{row.isPublished ? '공개' : '비공개'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/admin/sermons/${row.id}/edit`} className="text-accent-deep hover:underline">
                        편집
                      </Link>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => generateSummaryAction(row.id), '요약 생성 완료')}
                        className="text-accent-deep hover:underline disabled:opacity-50"
                      >
                        요약
                      </button>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
