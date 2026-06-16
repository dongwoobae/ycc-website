// TODO: Supabase CRUD 연결
export default function AdminSermonsPage() {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-ink">설교 관리</h1>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm text-bg hover:bg-accent-deep">
          + 새 설교 등록
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[44rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['날짜', '제목', '설교자', '예배구분', '공개', '관리'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <td className="px-4 py-3 text-ink-muted" colSpan={6}>
                등록된 설교가 없습니다.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
