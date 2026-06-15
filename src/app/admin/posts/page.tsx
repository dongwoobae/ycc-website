// TODO: Supabase CRUD 연결
export default function AdminPostsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">소식/공지 관리</h1>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm text-bg hover:bg-accent-deep">
          + 새 게시글 작성
        </button>
      </div>
      <div className="overflow-hidden rounded-xl bg-paper shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['날짜', '제목', '카테고리', '고정', '공개', '관리'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <td className="px-4 py-3 text-ink-muted" colSpan={6}>
                등록된 게시글이 없습니다.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
