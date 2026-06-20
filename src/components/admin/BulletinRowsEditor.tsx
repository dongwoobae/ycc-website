'use client'

import { useState } from 'react'
import SubmitButton from './SubmitButton'
import type { BulletinSection } from '@/lib/types'

type Row = NonNullable<BulletinSection['rows']>[number]
type EditorRow = Row & { editorId: string }

function withEditorIds(rows: Row[], previous: EditorRow[] = []) {
  const usedIds = new Set<string>()
  return rows.map((row, index) => {
    const match = previous.find((item) => !usedIds.has(item.editorId) && item.label === row.label && item.value === row.value)
    const indexEditorId = previous[index]?.editorId
    const editorId = match?.editorId ?? (indexEditorId && !usedIds.has(indexEditorId) ? indexEditorId : undefined) ?? crypto.randomUUID()
    usedIds.add(editorId)
    return { ...row, editorId }
  })
}

function serialize(rows: EditorRow[]): Row[] {
  return rows.map((row) => ({ label: row.label, value: row.value }))
}

export default function BulletinRowsEditor({ rows, onChange }: { rows: Row[]; onChange: (rows: Row[]) => void }) {
  const [editorRows, setEditorRows] = useState(() => withEditorIds(rows))
  const [prevRows, setPrevRows] = useState(rows)

  if (prevRows !== rows) {
    setPrevRows(rows)
    setEditorRows((current) => (JSON.stringify(serialize(current)) === JSON.stringify(rows) ? current : withEditorIds(rows, current)))
  }

  function commit(next: EditorRow[]) {
    setEditorRows(next)
    onChange(serialize(next))
  }

  function update(index: number, patch: Partial<Row>) {
    commit(editorRows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-ink">항목</h4>
        <button type="button" onClick={() => commit([...editorRows, { editorId: crypto.randomUUID(), label: '', value: '' }])} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink">
          항목 추가
        </button>
      </div>
      {editorRows.map((row, index) => (
        <div key={row.editorId} className="grid gap-2 md:grid-cols-[12rem_1fr_auto]">
          <input value={row.label} onChange={(event) => update(index, { label: event.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="라벨" />
          <input value={row.value} onChange={(event) => update(index, { value: event.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="내용" />
          <SubmitButton type="button" onClick={() => commit(editorRows.filter((_, i) => i !== index))} className="rounded-lg border border-line px-3 py-2 text-xs text-ink-muted">
            삭제
          </SubmitButton>
        </div>
      ))}
    </div>
  )
}
