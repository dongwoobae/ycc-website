'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Container from '@/components/layout/Container'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="py-28 sm:py-36">
      <Container className="max-w-2xl text-center">
        <h1 className="font-serif text-3xl font-extrabold text-ink sm:text-4xl">
          문제가 발생했습니다
        </h1>
        <p className="mt-4 text-ink-muted">
          잠시 후 다시 시도해 주세요. 문제가 계속되면 교회로 문의해 주세요.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper transition hover:opacity-90"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="rounded-full border border-line px-6 py-3 text-sm font-bold text-ink transition hover:bg-surface"
          >
            홈으로
          </Link>
        </div>
      </Container>
    </div>
  )
}
