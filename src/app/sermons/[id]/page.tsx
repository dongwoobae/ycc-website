// Next.js 16: params는 Promise
interface Props {
  params: Promise<{ id: string }>
}

export default async function SermonDetailPage({ params }: Props) {
  const { id } = await params
  // TODO: Supabase에서 id로 sermon fetch

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-2 text-sm text-blue-600">주일예배</p>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">설교 제목 (ID: {id})</h1>
      <p className="mb-6 text-sm text-gray-500">홍길동 목사 · 요한복음 3:16 · 2025-01-05</p>
      <div className="mb-6 flex aspect-video items-center justify-center rounded-xl bg-gray-200 text-gray-400">
        YouTube 영상 영역
      </div>
      <div className="mb-8 flex gap-3">
        <button className="rounded-lg bg-gray-100 px-4 py-2 text-sm">오디오 듣기</button>
        <button className="rounded-lg bg-gray-100 px-4 py-2 text-sm">설교문 PDF</button>
      </div>
    </div>
  )
}
