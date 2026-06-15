import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import SectionTitle from '@/components/ui/SectionTitle'

export const metadata: Metadata = {
  title: '교회연혁',
}

const history = [
  ['2000', '지역 복음화와 다음세대 사역을 위한 교육 부서 사역 정비'],
  ['2006', '창립 50주년 감사예배 및 지역 섬김 사역 확대'],
  ['2016', '창립 60주년 감사예배, 선교 후원 사역 재정비'],
  ['2020', '온라인 예배와 영상 설교 사역 시작'],
  ['2024', '교회학교와 청춘교실 사역 강화'],
  ['2026', '구역이 살아나고 지역 사회를 섬기는 교회 표어로 사역 진행'],
]

export default function HistoryPage() {
  return (
    <div className="py-16">
      <Container>
        <SectionTitle eyebrow="History" title="교회연혁" description="2000년 이후 주요 흐름을 먼저 정리한 초안입니다." />
        <ol className="mt-10 space-y-5">
          {history.map(([year, content]) => (
            <li key={year} className="grid gap-4 rounded-lg border border-line bg-paper p-6 shadow-subtle sm:grid-cols-[8rem_1fr]">
              <time className="font-serif text-3xl text-accent">{year}</time>
              <p className="leading-7 text-ink-muted">{content}</p>
            </li>
          ))}
        </ol>
      </Container>
    </div>
  )
}
