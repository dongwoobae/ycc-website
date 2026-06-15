'use client'

import BulletinOfferingsEditor from './BulletinOfferingsEditor'
import BulletinRowsEditor from './BulletinRowsEditor'
import { BodyEditor } from './BulletinSectionText'
import BulletinTablesEditor from './BulletinTablesEditor'
import type { BulletinSection } from '@/lib/types'

interface BulletinSectionEditorProps {
  sections: BulletinSection[]
  onChange: (sections: BulletinSection[]) => void
}

const emptySection = (): BulletinSection => ({ id: crypto.randomUUID(), title: '새 섹션', body: [''] })

export default function BulletinSectionEditor({ sections, onChange }: BulletinSectionEditorProps) {
  function update(index: number, section: BulletinSection) {
    onChange(sections.map((item, i) => (i === index ? section : item)))
  }

  function move(index: number, offset: number) {
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= sections.length) return
    const next = [...sections]
    const [item] = next.splice(index, 1)
    next.splice(nextIndex, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">섹션</h2>
        <button type="button" onClick={() => onChange([...sections, emptySection()])} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg">
          섹션 추가
        </button>
      </div>
      {sections.map((section, index) => (
        <SectionCard
          key={section.id || index}
          section={section}
          onChange={(next) => update(index, next)}
          onDelete={() => onChange(sections.filter((_, i) => i !== index))}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          canMoveUp={index > 0}
          canMoveDown={index < sections.length - 1}
        />
      ))}
    </div>
  )
}

function SectionCard({
  section,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  section: BulletinSection
  onChange: (section: BulletinSection) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  return (
    <section className="space-y-4 rounded-xl bg-paper p-6 shadow-sm">
      <SectionHeader {...{ section, onChange, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }} />
      <TypeToggles section={section} onChange={onChange} />
      {section.body ? <BodyEditor value={section.body} onChange={(body) => onChange({ ...section, body })} /> : null}
      {section.rows ? <BulletinRowsEditor rows={section.rows} onChange={(rows) => onChange({ ...section, rows })} /> : null}
      {section.tables ? <BulletinTablesEditor tables={section.tables} onChange={(tables) => onChange({ ...section, tables })} /> : null}
      {section.offerings ? <BulletinOfferingsEditor offerings={section.offerings} onChange={(offerings) => onChange({ ...section, offerings })} /> : null}
    </section>
  )
}

function SectionHeader(props: {
  section: BulletinSection
  onChange: (section: BulletinSection) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
      <input value={props.section.title} onChange={(event) => props.onChange({ ...props.section, title: event.target.value })} className="rounded-lg border border-line bg-bg px-4 py-3 text-sm font-medium text-ink outline-none focus:border-accent" required />
      <div className="flex flex-wrap items-center gap-2">
        <SmallButton onClick={props.onMoveUp} disabled={!props.canMoveUp} label="위" />
        <SmallButton onClick={props.onMoveDown} disabled={!props.canMoveDown} label="아래" />
        <SmallButton onClick={props.onDelete} label="삭제" />
      </div>
    </div>
  )
}

function SmallButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded-lg border border-line px-3 py-2 text-xs text-ink transition hover:bg-surface disabled:opacity-40">
      {label}
    </button>
  )
}

function TypeToggles({ section, onChange }: { section: BulletinSection; onChange: (section: BulletinSection) => void }) {
  return (
    <div className="flex flex-wrap gap-4">
      <Toggle label="본문" checked={!!section.body} onChange={(checked) => onChange({ ...section, body: checked ? section.body ?? [''] : undefined })} />
      <Toggle label="항목" checked={!!section.rows} onChange={(checked) => onChange({ ...section, rows: checked ? section.rows ?? [{ label: '', value: '' }] : undefined })} />
      <Toggle label="표" checked={!!section.tables} onChange={(checked) => onChange({ ...section, tables: checked ? section.tables ?? [{ title: '', headers: [], rows: [] }] : undefined })} />
      <Toggle label="헌금" checked={!!section.offerings} onChange={(checked) => onChange({ ...section, offerings: checked ? section.offerings ?? [{ category: '', names: [] }] : undefined })} />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-accent" />
      {label}
    </label>
  )
}
