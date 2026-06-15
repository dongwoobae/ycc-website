// TODO: Supabase app_logs 테이블 fetch로 교체
export default function AdminLogPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-ink">서버 로그</h1>
      <div className="mb-4 flex gap-3">
        <select className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
          <option>전체 액션</option>
          <option>create</option>
          <option>update</option>
          <option>delete</option>
          <option>error</option>
          <option>login</option>
        </select>
        <input type="date" className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm" />
      </div>
      <div className="overflow-hidden rounded-xl bg-paper shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['시간', '액션', '대상', 'ID', '메시지', '사용자'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <td className="px-4 py-3 text-ink-muted" colSpan={6}>
                로그가 없습니다.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
