import { Skeleton } from '@/components/ui/Skeleton'

interface AdminTableSkeletonProps {
  headings: string[]
  rows?: number
  minWidthClass?: string
}

/** admin 목록 페이지 공통 테이블 스켈레톤. 헤더는 실제 텍스트를 그대로 보여준다. */
export default function AdminTableSkeleton({
  headings,
  rows = 8,
  minWidthClass = 'min-w-[48rem]',
}: AdminTableSkeletonProps) {
  return (
    <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
      <table className={`${minWidthClass} w-full text-sm`}>
        <thead className="bg-surface text-ink-muted">
          <tr>
            {headings.map((heading) => (
              <th key={heading} className="px-4 py-3 text-left font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t border-line">
              {headings.map((heading) => (
                <td key={heading} className="px-4 py-3">
                  <Skeleton className="h-4 w-full max-w-[9rem]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
