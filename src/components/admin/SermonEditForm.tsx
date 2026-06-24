'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateSummaryAction, updateSermonAction, type SermonEditInput } from '@/lib/actions/sermons'
import { formatTimestamp } from '@/lib/sermons/format'
import type { SermonChapter } from '@/lib/types'
import { worshipTypes } from '@/lib/worship'

interface Props {
  id: string
  initial: SermonEditInput
  summaryStatus: string
  quickSummary: string[]
  chapters: SermonChapter[]
}

export default function SermonEditForm({ id, initial, summaryStatus, quickSummary, chapters }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<SermonEditInput>(initial)
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()

  function set<K extends keyof SermonEditInput>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <label className="block">
          <span className="text-sm text-ink-muted">제목</span>
          <input
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm text-ink-muted">목록 표시 제목 (선택 — 비우면 자동 정리)</span>
          <input
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
            value={form.displayTitle}
            placeholder="목록에 표시할 제목"
            onChange={(event) => set('displayTitle', event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm text-ink-muted">설교자 (공개 전 필수)</span>
          <input
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
            value={form.preacher}
            onChange={(event) => set('preacher', event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm text-ink-muted">예배 종류</span>
          <select
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
            value={form.worshipType}
            onChange={(event) => set('worshipType', event.target.value)}
          >
            {worshipTypes.map((worshipType) => (
              <option key={worshipType} value={worshipType}>
                {worshipType}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-ink-muted">날짜</span>
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
            value={form.sermonDate}
            onChange={(event) => set('sermonDate', event.target.value)}
          />
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg('')
            startTransition(async () => {
              try {
                await updateSermonAction(id, form)
                setMsg('저장됨')
                router.refresh()
              } catch (e) {
                setMsg(e instanceof Error ? e.message : String(e))
              }
            })
          }}
          className="rounded-md bg-accent-deep px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          저장
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg('')
            startTransition(async () => {
              try {
                const status = await generateSummaryAction(id)
                setMsg(`요약: ${status}`)
                router.refresh()
              } catch (e) {
                setMsg(e instanceof Error ? e.message : String(e))
              }
            })
          }}
          className="rounded-md border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          요약 재생성
        </button>
        {msg && <span className="self-center text-sm text-ink-muted">{msg}</span>}
      </div>

      <div className="rounded-lg border border-line p-4">
        <p className="text-sm text-ink-muted">
          요약 상태: <strong>{summaryStatus}</strong>
        </p>
        {quickSummary.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-ink-muted">
            {quickSummary.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
        {chapters.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {chapters.map((chapter, i) => (
              <li key={i}>
                <span className="font-mono text-accent-deep">{formatTimestamp(chapter.startSeconds)}</span> ·{' '}
                {chapter.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
