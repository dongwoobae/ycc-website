import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import AboutSubnav from '@/components/about/AboutSubnav'
import Reveal from '@/components/ui/Reveal'

export const metadata: Metadata = {
  title: '교회연혁',
  description: '영천중앙교회가 걸어온 역사와 발자취를 소개합니다.',
  alternates: {
    canonical: '/about/history',
  },
}

const history = [
  ['1956', '09.02. 영천제일교회에서 분립, 예배당 설립 후 영천남부교회로 명명'],
  ['1958', '05.03. 현 위치에 예배당 신축, 영천중앙교회로 개명'],
  ['1976', '03.30. 성전 기공 · 09.01. 고경 오류리 부활동산 매입'],
  ['1978', '08.31. 성전 헌당'],
  ['1987', '12.30. 선교관 준공'],
  ['2006', '11.05. 창립 50주년 기념 종탑 설치 (초대교회의 종)'],
  ['2012', '01.03. 본 교회에서 명성교회 분립개척'],
  ['2013', '02.03. 본 교회에서 사랑의교회 분립개척'],
  ['2025', '09.07. 창립 70주년 기념비(팔복) 설치, 선교관 외관 정비 후 교육관으로 개명'],
]

export default function HistoryPage() {
  return (
    <>
      <PageHero
        eyebrow="History"
        title="교회연혁"
        subtitle="1956년 창립 이후, 영천중앙교회가 걸어온 발자취입니다."
      />
      <AboutSubnav />
      <section className="py-20 sm:py-24">
        <Container className="max-w-3xl">
          <Reveal variant="fade">
            <p className="text-[13px] font-bold text-accent-deep">OUR STORY</p>
          </Reveal>
          <Reveal variant="fade" delay={120}>
            <h2 className="mt-3 font-serif text-3xl font-extrabold leading-snug tracking-tight text-ink sm:text-4xl">
              영천중앙교회의 시작 이야기
            </h2>
          </Reveal>
          <Reveal variant="fade" delay={200}>
            <div className="mt-7 space-y-5 text-[17.5px] leading-9 text-ink-muted">
              <p>
                영천중앙교회의 시작은 사람의 계획보다 앞서 일하신 하나님의 은혜에서 비롯되었습니다.
              </p>
              <p>
                19세기 미국의 부흥과 선교의 불씨는 조선 땅으로 이어졌고, 대구·경북 지역에 복음의
                씨앗이 심겨졌습니다. 그 복음의 흐름은 영천 땅에도 닿아 영천제일교회를 거쳐
                주남기도처로 이어졌고, 마침내 오늘의 영천중앙교회로 자라났습니다.
              </p>
              <p>
                작은 기도의 자리에서 시작된 교회는 오랜 세월 예배와 말씀, 섬김의 발걸음을 이어 오며
                이 지역 가운데 복음의 빛을 비추어 왔습니다.
              </p>
              <p>
                영천중앙교회는 지금도 그 은혜의 뿌리 위에 서서, 다음 세대와 이웃을 향해 복음의
                이야기를 이어가고 있습니다.
              </p>
            </div>
          </Reveal>
        </Container>
      </section>
      <div className="border-t border-line pb-20 pt-20 sm:pb-24 sm:pt-24">
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
                    <div className={`rounded-2xl border border-line bg-paper p-7 shadow-subtle ${left ? 'sm:text-right' : ''}`}>
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
