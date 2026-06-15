// TODO: Supabase에서 통계 fetch
export default function AdminDashboard() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-ink">대시보드</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: '전체 설교', value: '-' },
          { label: '전체 게시글', value: '-' },
          { label: '이번 달 조회수', value: '-' },
          { label: '최근 로그', value: '-' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-paper p-5 shadow-sm">
            <p className="text-sm text-ink-muted">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
