import AdminPageHero from '@/components/admin/AdminPageHero'
import { Skeleton } from '@/components/ui/Skeleton'

const HEADINGS = ['행사일', '표지', '앨범명', '공개', '관리']

export default function Loading() {
  return (
    <div role="status" aria-label="앨범 목록을 불러오는 중입니다">
      <AdminPageHero
        title="갤러리 관리"
        image="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1600&q=80"
        action={<Skeleton className="h-10 w-20 rounded-lg bg-white/40" />}
      />
      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[48rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {HEADINGS.map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="size-16 rounded-lg" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-56" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-12" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-7 w-24 rounded-lg" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
