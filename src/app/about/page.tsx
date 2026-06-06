export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <section>
        <h1 className="mb-4 text-2xl font-bold text-gray-900">교회 소개</h1>
        <p className="leading-relaxed text-gray-600">영천중앙교회는 ... (교회 소개 문구 입력)</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold text-gray-800">비전</h2>
        <p className="text-gray-600">교회 비전 문구 입력</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold text-gray-800">담임 목사</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-400">
            사진
          </div>
          <div>
            <p className="font-semibold text-gray-900">목사 성함</p>
            <p className="text-sm text-gray-500">담임목사</p>
          </div>
        </div>
      </section>
    </div>
  )
}
