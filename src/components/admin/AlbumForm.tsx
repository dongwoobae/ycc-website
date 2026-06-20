'use client'

import { FormEvent, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SubmitButton from './SubmitButton'

export interface AlbumFormInitialValue {
  title: string
  description: string
  eventDate: string
  isPublished: boolean
}

interface AlbumFormProps {
  initialValue?: AlbumFormInitialValue
  submitLabel: string
  submitAction: (formData: FormData) => Promise<string | void>
  coverRequired?: boolean
}

const emptyAlbum: AlbumFormInitialValue = {
  title: '',
  description: '',
  eventDate: new Date().toISOString().slice(0, 10),
  isPublished: true,
}

export default function AlbumForm({ initialValue, submitLabel, submitAction, coverRequired = false }: AlbumFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState<AlbumFormInitialValue>(initialValue ?? emptyAlbum)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formRef.current) return
    setError('')
    const formData = new FormData(formRef.current)
    startTransition(async () => {
      try {
        await submitAction(formData)
        router.push('/admin/gallery')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 rounded-xl bg-paper p-6 shadow-sm">
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-medium text-ink">앨범명</label>
        <input id="title" name="title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent" required />
      </div>

      <div>
        <label htmlFor="description" className="mb-2 block text-sm font-medium text-ink">설명</label>
        <textarea id="description" name="description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-32 w-full resize-y rounded-lg border border-line bg-bg px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-accent" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="eventDate" className="mb-2 block text-sm font-medium text-ink">행사일</label>
          <input id="eventDate" name="eventDate" type="date" value={form.eventDate} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent" />
        </div>

        <div>
          <label htmlFor="cover" className="mb-2 block text-sm font-medium text-ink">표지 이미지</label>
          <input id="cover" name="cover" type="file" accept="image/*" required={coverRequired} className="w-full rounded-lg border border-line bg-bg px-4 py-2.5 text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-bg" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input name="isPublished" type="checkbox" checked={form.isPublished} onChange={(event) => setForm((current) => ({ ...current, isPublished: event.target.checked }))} className="size-4 accent-accent" />
        공개
      </label>

      {error ? <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.push('/admin/gallery')} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface">
          취소
        </button>
        <SubmitButton pendingOverride={isPending} pendingLabel="저장 중..." className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  )
}
