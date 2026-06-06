export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">오시는 길</h1>
      <div className="flex aspect-video items-center justify-center rounded-xl bg-gray-200 text-gray-400">
        지도 영역 (카카오맵/네이버지도 embed)
      </div>
      <div className="grid grid-cols-1 gap-6 text-sm text-gray-700 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 font-semibold text-gray-900">주소</h2>
          <p>경북 영천시 (상세 주소 입력)</p>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-gray-900">예배 시간</h2>
          <p>주일 1부: 오전 9시</p>
          <p>주일 2부: 오전 11시</p>
          <p>수요 예배: 오후 7시 30분</p>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-gray-900">전화</h2>
          <p>000-000-0000</p>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-gray-900">대중교통</h2>
          <p>버스: 00번, 00번</p>
        </div>
      </div>
    </div>
  )
}
