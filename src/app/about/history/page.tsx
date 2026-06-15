import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import Reveal from '@/components/ui/Reveal'

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
    <>
      <PageHero
        eyebrow="History"
        title="교회연혁"
        subtitle="1956년 창립 이후, 영천중앙교회가 걸어온 발자취입니다."
        image="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="py-16">
        <Container className="max-w-4xl">
          <ol className="relative">
            <div className="absolute left-1/2 top-2 hidden h-[calc(100%-1rem)] w-px -translate-x-1/2 bg-line sm:block" />
            {history.map(([year, content], i) => {
              const left = i % 2 === 0
              return (
                <li key={year} className="relative mb-8 last:mb-0 sm:grid sm:grid-cols-2 sm:gap-10">
                  <span className="absolute left-1/2 top-6 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-bg bg-accent sm:block" />
                  <Reveal
                    variant={left ? 'left' : 'right'}
                    className={left ? 'sm:col-start-1' : 'sm:col-start-2'}
                  >
                    <div className={`rounded-lg border border-line bg-paper p-6 shadow-subtle ${left ? 'sm:text-right' : ''}`}>
                      <time className="font-serif text-3xl font-extrabold tracking-tight text-accent-deep">{year}</time>
                      <p className="mt-3 leading-7 text-ink-muted">{content}</p>
                    </div>
                  </Reveal>
                </li>
              )
            })}
          </ol>
        </Container>
      </div>
    </>
  )
}
