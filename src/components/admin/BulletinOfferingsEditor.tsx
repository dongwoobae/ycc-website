'use client'

import { useState } from 'react'
import { ListInput } from './BulletinSectionText'
import SubmitButton from './SubmitButton'
import type { BulletinOffering } from '@/lib/types'

type EditorOffering = BulletinOffering & { editorId: string }

function withEditorIds(offerings: BulletinOffering[], previous: EditorOffering[] = []) {
  const usedIds = new Set<string>()
  return offerings.map((offering, index) => {
    const match = previous.find((item) => !usedIds.has(item.editorId) && item.category === offering.category && JSON.stringify(item.names) === JSON.stringify(offering.names))
    const indexEditorId = previous[index]?.editorId
    const editorId = match?.editorId ?? (indexEditorId && !usedIds.has(indexEditorId) ? indexEditorId : undefined) ?? crypto.randomUUID()
    usedIds.add(editorId)
    return { ...offering, editorId }
  })
}

function serialize(offerings: EditorOffering[]): BulletinOffering[] {
  return offerings.map((offering) => ({ category: offering.category, names: offering.names }))
}

export default function BulletinOfferingsEditor({
  offerings,
  onChange,
}: {
  offerings: BulletinOffering[]
  onChange: (offerings: BulletinOffering[]) => void
}) {
  const [editorOfferings, setEditorOfferings] = useState(() => withEditorIds(offerings))
  const [prevOfferings, setPrevOfferings] = useState(offerings)

  if (prevOfferings !== offerings) {
    setPrevOfferings(offerings)
    setEditorOfferings((current) => (JSON.stringify(serialize(current)) === JSON.stringify(offerings) ? current : withEditorIds(offerings, current)))
  }

  function commit(next: EditorOffering[]) {
    setEditorOfferings(next)
    onChange(serialize(next))
  }

  function update(index: number, patch: Partial<BulletinOffering>) {
    commit(editorOfferings.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-ink">헌금</h4>
        <button type="button" onClick={() => commit([...editorOfferings, { editorId: crypto.randomUUID(), category: '', names: [] }])} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink">
          헌금 추가
        </button>
      </div>
      {editorOfferings.map((offering, index) => (
        <div key={offering.editorId} className="space-y-3 rounded-lg border border-line bg-bg p-4">
          <input value={offering.category} onChange={(event) => update(index, { category: event.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="분류" />
          <ListInput label="이름" value={offering.names} onChange={(names) => update(index, { names })} />
          <SubmitButton type="button" onClick={() => commit(editorOfferings.filter((_, i) => i !== index))} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted">
            삭제
          </SubmitButton>
        </div>
      ))}
    </div>
  )
}
