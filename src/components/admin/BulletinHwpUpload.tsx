'use client'

import { FormEvent, useRef, useState, useTransition } from 'react'
import { parseHwpAction } from '@/lib/actions/bulletins'
import type { BulletinSection } from '@/lib/types'

interface BulletinHwpUploadProps {
  onParsed: (sections: BulletinSection[], hwpSourceUrl: string) => void
}

export default function BulletinHwpUpload({ onParsed }: BulletinHwpUploadProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formRef.current) return
    setError('')
    const formData = new FormData(formRef.current)
    startTransition(async () => {
      try {
        const parsed = await parseHwpAction(formData)
        onParsed(parsed.sections, parsed.hwpSourceUrl)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'hwp 파싱에 실패했습니다.')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-paper p-6 shadow-sm">
      <label htmlFor="file" className="block text-sm font-medium text-ink">
        HWP 원본
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="file"
          name="file"
          type="file"
          accept=".hwp,application/x-hwp"
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-4 py-2.5 text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-bg"
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-50"
        >
          {isPending ? '추출 중...' : '추출'}
        </button>
      </div>
      {error ? <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{error}</p> : null}
    </form>
  )
}
