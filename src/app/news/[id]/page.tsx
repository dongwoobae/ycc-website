// Next.js 16: params는 Promise
interface Props {
  params: Promise<{ id: string }>
}

export default async function NewsDetailPage({ params }: Props) {
  const { id } = await params
  // TODO: Supabase에서 id로 post fetch

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-1 text-xs text-gray-400">공지 · 2025-01-05</p>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">게시글 제목 (ID: {id})</h1>
      <div className="prose max-w-none text-gray-700">
        <p>게시글 내용이 여기 표시됩니다. TODO: Supabase fetch</p>
      </div>
    </div>
  )
}
