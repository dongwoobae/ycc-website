'use client'

import type { BulletinSection } from '@/lib/types'

type Row = NonNullable<BulletinSection['rows']>[number]

export default function BulletinRowsEditor({ rows, onChange }: { rows: Row[]; onChange: (rows: Row[]) => void }) {
  function update(index: number, patch: Partial<Row>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-ink">항목</h4>
        <button type="button" onClick={() => onChange([...rows, { label: '', value: '' }])} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink">
          항목 추가
        </button>
      </div>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-[12rem_1fr_auto]">
          <input value={row.label} onChange={(event) => update(index, { label: event.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="라벨" />
          <input value={row.value} onChange={(event) => update(index, { value: event.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="내용" />
          <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))} className="rounded-lg border border-line px-3 py-2 text-xs text-ink-muted">
            삭제
          </button>
        </div>
      ))}
    </div>
  )
}
