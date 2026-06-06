import SermonCard from '@/components/sermons/SermonCard'

// TODO: Supabase fetch로 교체
const SAMPLE_SERMONS = Array.from({ length: 6 }, (_, i) => ({
  id: `s${i + 1}`,
  title: `샘플 설교 제목 ${i + 1}`,
  preacher: '홍길동 목사',
  scripture: '창세기 1:1',
  worshipType: i % 2 === 0 ? '주일예배' : '수요예배',
  sermonDate: `2025-01-${String(i + 1).padStart(2, '0')}`,
}))

export default function SermonsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">예배 &amp; 설교</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {SAMPLE_SERMONS.map((sermon) => (
          <SermonCard key={sermon.id} {...sermon} />
        ))}
      </div>
    </div>
  )
}
