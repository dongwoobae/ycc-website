'use client'

interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

const baseBtn = 'rounded-md border px-3 py-2 text-sm font-semibold transition disabled:opacity-40'

export default function SermonsPagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-2" aria-label="설교 목록 페이지">
      <button type="button" className={`${baseBtn} border-line`} disabled={page === 1} onClick={() => onChange(page - 1)}>
        이전
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
          className={`${baseBtn} ${p === page ? 'border-accent bg-accent text-white' : 'border-line text-ink-muted hover:border-accent'}`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className={`${baseBtn} border-line`}
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        다음
      </button>
    </nav>
  )
}
