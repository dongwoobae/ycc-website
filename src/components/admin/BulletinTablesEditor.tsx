'use client'

import { useState } from 'react'
import { formatTableCells, parseTableRows } from '@/lib/bulletin-editor'
import { BodyEditor, ListInput } from './BulletinSectionText'
import SubmitButton from './SubmitButton'
import type { BulletinTable } from '@/lib/types'

type EditorTable = BulletinTable & { editorId: string }

function withEditorIds(tables: BulletinTable[], previous: EditorTable[] = []) {
  const usedIds = new Set<string>()
  return tables.map((table, index) => {
    const match = previous.find((item) => !usedIds.has(item.editorId) && item.title === table.title && JSON.stringify(item.headers) === JSON.stringify(table.headers) && JSON.stringify(item.rows) === JSON.stringify(table.rows))
    const indexEditorId = previous[index]?.editorId
    const editorId = match?.editorId ?? (indexEditorId && !usedIds.has(indexEditorId) ? indexEditorId : undefined) ?? crypto.randomUUID()
    usedIds.add(editorId)
    return { ...table, editorId }
  })
}

function serialize(tables: EditorTable[]): BulletinTable[] {
  return tables.map((table) => ({ title: table.title, headers: table.headers, rows: table.rows }))
}

export default function BulletinTablesEditor({
  tables,
  onChange,
}: {
  tables: BulletinTable[]
  onChange: (tables: BulletinTable[]) => void
}) {
  const [editorTables, setEditorTables] = useState(() => withEditorIds(tables))
  const [prevTables, setPrevTables] = useState(tables)

  if (prevTables !== tables) {
    setPrevTables(tables)
    setEditorTables((current) => (JSON.stringify(serialize(current)) === JSON.stringify(tables) ? current : withEditorIds(tables, current)))
  }

  function commit(next: EditorTable[]) {
    setEditorTables(next)
    onChange(serialize(next))
  }

  function update(index: number, patch: Partial<BulletinTable>) {
    commit(editorTables.map((table, i) => (i === index ? { ...table, ...patch } : table)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-ink">표</h4>
        <button type="button" onClick={() => commit([...editorTables, { editorId: crypto.randomUUID(), title: '', headers: [], rows: [] }])} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink">
          표 추가
        </button>
      </div>
      {editorTables.map((table, index) => (
        <TableBlock key={table.editorId} table={table} onChange={(patch) => update(index, patch)} onDelete={() => commit(editorTables.filter((_, i) => i !== index))} />
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
  const [error, setError] = useState('')
  const serializationError = getTableSerializationError(table)

  function updateRows(lines: string[]) {
    try {
      const rows = parseTableRows(lines, table.headers.length || undefined)
      setError('')
      onChange({ rows })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid table row.')
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-bg p-4">
      <input value={table.title} onChange={(event) => onChange({ title: event.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="표 제목" />
      <ListInput label="헤더" value={table.headers} onChange={(headers) => onChange({ headers })} />
      <BodyEditor value={table.rows.map((row) => row.join('\t'))} onChange={updateRows} />
      {error || serializationError ? <p className="rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink-muted">{error || serializationError}</p> : null}
      <SubmitButton type="button" onClick={onDelete} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted">
        삭제
      </SubmitButton>
    </div>
  )
}

function getTableSerializationError(table: BulletinTable) {
  try {
    table.rows.forEach(formatTableCells)
    return ''
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid table row.'
  }
}
