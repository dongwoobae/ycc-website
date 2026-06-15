'use client'

import { FormEvent, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import BulletinField from './BulletinField'
import BulletinHwpUpload from './BulletinHwpUpload'
import BulletinSectionEditor from './BulletinSectionEditor'
import type { BulletinFormInput } from '@/lib/actions/bulletins'

interface BulletinFormProps {
  initialValue?: BulletinFormInput
  submitLabel: string
  submitAction: (input: BulletinFormInput) => Promise<string | void>
}

const emptyBulletin: BulletinFormInput = {
  bulletinDate: new Date().toISOString().slice(0, 10),
  volume: '',
  issue: '',
  theme: '',
  scripture: '',
  sections: [],
  hwpSourceUrl: '',
}

export default function BulletinForm({ initialValue, submitLabel, submitAction }: BulletinFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState<BulletinFormInput>(initialValue ?? emptyBulletin)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        await submitAction(form)
        router.push('/admin/bulletins')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <BulletinHwpUpload onParsed={(sections, hwpSourceUrl) => setForm((current) => ({ ...current, sections, hwpSourceUrl }))} />
      <form onSubmit={handleSubmit} className="space-y-6">
        <MetaFields form={form} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
        <BulletinSectionEditor sections={form.sections} onChange={(sections) => setForm((current) => ({ ...current, sections }))} />
        {error ? <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{error}</p> : null}
        <FormActions isPending={isPending} submitLabel={submitLabel} />
      </form>
    </div>
  )
}

function MetaFields({ form, onChange }: { form: BulletinFormInput; onChange: (patch: Partial<BulletinFormInput>) => void }) {
  return (
    <div className="grid gap-4 rounded-xl bg-paper p-6 shadow-sm md:grid-cols-2">
      <BulletinField id="bulletinDate" label="주보일" type="date" value={form.bulletinDate} required onChange={(bulletinDate) => onChange({ bulletinDate })} />
      <BulletinField id="volume" label="권" value={form.volume} onChange={(volume) => onChange({ volume })} />
      <BulletinField id="issue" label="호" value={form.issue} onChange={(issue) => onChange({ issue })} />
      <BulletinField id="theme" label="주제" value={form.theme} onChange={(theme) => onChange({ theme })} />
      <div className="md:col-span-2">
        <BulletinField id="scripture" label="말씀" value={form.scripture} onChange={(scripture) => onChange({ scripture })} />
      </div>
    </div>
  )
}

function FormActions({ isPending, submitLabel }: { isPending: boolean; submitLabel: string }) {
  const router = useRouter()
  return (
    <div className="flex items-center justify-end gap-3 rounded-xl bg-paper p-6 shadow-sm">
      <button type="button" onClick={() => router.push('/admin/bulletins')} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface">
        취소
      </button>
      <button type="submit" disabled={isPending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep disabled:opacity-60">
        {isPending ? '저장 중...' : submitLabel}
      </button>
    </div>
  )
}
