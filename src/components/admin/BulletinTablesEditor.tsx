'use client'

import { BodyEditor, ListInput } from './BulletinSectionText'
import type { BulletinTable } from '@/lib/types'

export default function BulletinTablesEditor({
  tables,
  onChange,
}: {
  tables: BulletinTable[]
  onChange: (tables: BulletinTable[]) => void
}) {
  function update(index: number, patch: Partial<BulletinTable>) {
    onChange(tables.map((table, i) => (i === index ? { ...table, ...patch } : table)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-ink">표</h4>
        <button type="button" onClick={() => onChange([...tables, { title: '', headers: [], rows: [] }])} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink">
          표 추가
        </button>
      </div>
      {tables.map((table, index) => (
        <TableBlock key={index} table={table} onChange={(patch) => update(index, patch)} onDelete={() => onChange(tables.filter((_, i) => i !== index))} />
      ))}
    </div>
  )
}

function TableBlock({
  table,
  onChange,
  onDelete,
}: {
  table: BulletinTable
  onChange: (patch: Partial<BulletinTable>) => void
  onDelete: () => void
}) {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-bg p-4">
      <input value={table.title} onChange={(event) => onChange({ title: event.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="표 제목" />
      <ListInput label="헤더" value={table.headers} onChange={(headers) => onChange({ headers })} />
      <BodyEditor value={table.rows.map((row) => row.join('\t'))} onChange={(lines) => onChange({ rows: lines.map((line) => line.split('\t')) })} />
      <button type="button" onClick={onDelete} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted">
        삭제
      </button>
    </div>
  )
}
