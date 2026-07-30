'use client'

import type { BulletinNotice } from '@/lib/types'

interface BulletinNoticesEditorProps {
  notices: BulletinNotice[]
  onChange: (notices: BulletinNotice[]) => void
}

const inputClass =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none transition focus:border-accent'

export default function BulletinNoticesEditor({ notices, onChange }: BulletinNoticesEditorProps) {
  function patch(index: number, next: Partial<BulletinNotice>) {
    onChange(notices.map((notice, i) => (i === index ? { ...notice, ...next } : notice)))
  }

  return (
    <div className="rounded-xl bg-paper p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">이번 주 일정 · 공지</h2>
        <button
          type="button"
          onClick={() => onChange([...notices, { title: '', detail: '', when: '' }])}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
        >
          항목 추가
        </button>
      </div>
      <p className="mt-1.5 text-xs text-faint">
        「시간」을 채우면 앞에 시간 배지가 붙고, 비우면 「공지」 배지가 붙습니다.
      </p>

      {notices.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
          아직 항목이 없습니다.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notices.map((notice, index) => (
            <li key={index} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[120px_1fr_1fr_auto]">
              <input
                aria-label={`${index + 1}번 항목 시간`}
                placeholder="토 09:00"
                value={notice.when ?? ''}
                onChange={(event) => patch(index, { when: event.target.value })}
                className={inputClass}
              />
              <input
                aria-label={`${index + 1}번 항목 제목`}
                placeholder="여름성경학교"
                value={notice.title}
                onChange={(event) => patch(index, { title: event.target.value })}
                className={inputClass}
              />
              <input
                aria-label={`${index + 1}번 항목 내용`}
                placeholder="8/1(토)~8/3(월) · 교육관 1층"
                value={notice.detail}
                onChange={(event) => patch(index, { detail: event.target.value })}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => onChange(notices.filter((_, i) => i !== index))}
                className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
