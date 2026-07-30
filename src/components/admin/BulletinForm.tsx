'use client'

import { FormEvent, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeBulletinInput } from '@/lib/bulletin-editor'
import BulletinGlanceFields from './BulletinGlanceFields'
import BulletinNoticesEditor from './BulletinNoticesEditor'
import BulletinOriginUpload from './BulletinOriginUpload'
import SubmitButton from './SubmitButton'
import BulletinView from '@/components/bulletins/BulletinView'
import { todayKst } from '@/lib/date'
import type { BulletinFormInput } from '@/lib/actions/bulletins'

interface BulletinFormProps {
  initialValue?: BulletinFormInput
  submitLabel: string
  submitAction: (input: BulletinFormInput) => Promise<string | void>
}

const emptyBulletin: BulletinFormInput = {
  bulletinDate: todayKst(),
  volume: '',
  issue: '',
  sermonTitle: '',
  scripture: '',
  preacher: '',
  hymns: '',
  responsiveReading: '',
  nextWeek: '',
  notices: [],
  pages: [],
}

export default function BulletinForm({ initialValue, submitLabel, submitAction }: BulletinFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [form, setForm] = useState<BulletinFormInput>(initialValue ?? emptyBulletin)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        await submitAction(normalizeBulletinInput(form))
        router.push('/admin/bulletins')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <BulletinOriginUpload
        bulletinDate={form.bulletinDate}
        pageCount={form.pages.length}
        onUploaded={({ pages, pdfUrl }) => setForm((current) => ({ ...current, pages, pdfUrl }))}
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        <BulletinGlanceFields form={form} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
        <BulletinNoticesEditor
          notices={form.notices}
          onChange={(notices) => setForm((current) => ({ ...current, notices }))}
        />

        {/* 미리보기는 공개 화면 컴포넌트를 그대로 재사용한다 — 보이는 것과 저장되는 것이 어긋나지 않게 */}
        <div className="rounded-xl bg-paper p-6 shadow-sm">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
          >
            {showPreview ? '미리보기 닫기' : '미리보기 열기'}
          </button>
          {showPreview ? (
            <div className="mt-5 border-t border-line pt-5">
              <BulletinView bulletin={{ ...normalizeBulletinInput(form), id: 'preview', isPublished: false }} />
            </div>
          ) : null}
        </div>

        {error ? <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{error}</p> : null}
        <div className="flex items-center justify-end gap-3 rounded-xl bg-paper p-6 shadow-sm">
          <button
            type="button"
            onClick={() => router.push('/admin/bulletins')}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
          >
            취소
          </button>
          <SubmitButton
            pendingOverride={isPending}
            pendingLabel="저장 중..."
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep disabled:opacity-60"
          >
            {submitLabel}
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}
