'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? '새로고침 중…' : '새로고침'}
    </button>
  )
}
