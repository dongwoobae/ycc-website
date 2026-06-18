import type { Metadata } from 'next'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import AboutSubnav from '@/components/about/AboutSubnav'
import Reveal from '@/components/ui/Reveal'

export const metadata: Metadata = {
  title: '교회소개',
}

const visions = [
  {
    title: '말씀과 예배',
    body: '예배 안에서 하나님을 만나고, 삶에 적용되는 말씀으로 한 주를 살아갑니다.',
    icon: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
  },
  {
    title: '구역과 다음세대',
    body: '작은 모임이 살아나고, 다음세대가 신앙 안에서 자라도록 함께 세웁니다.',
    icon: (
      <>
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
      </>
    ),
  },
  {
    title: '지역을 섬김',
    body: '영천의 이웃 곁으로 다가가 복음의 소망을 나누고 선교의 자리를 넓혀갑니다.',
    icon: (
      <>
        <path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
]

const stats = [
  { n: '1956', unit: null, label: '창립 연도' },
  { n: '70', unit: '년', label: '함께 걸어온 시간' },
  { n: '6', unit: '개', label: '교회학교 부서' },
  { n: '4', unit: '곳', label: '국내외 선교지' },
]

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Welcome"
        title="교회소개"
        subtitle="영천중앙교회는 1956년 창립 이후 말씀과 예배, 선교와 섬김으로 지역 사회와 함께 걸어왔습니다."
        image="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80"
      />
      <AboutSubnav />

      <section className="py-20 sm:py-24">
        <Container size="wide">
          <div className="max-w-[760px]">
            <Reveal variant="fade">
              <p className="text-[13px] font-bold text-accent-deep">OUR STORY</p>
            </Reveal>
            <Reveal variant="fade" delay={120}>
              <h2 className="mt-3 font-serif text-3xl font-extrabold leading-snug tracking-tight text-ink sm:text-4xl">
                처음 오신 분도 편안히
                <br />
                머물 수 있는 교회
              </h2>
            </Reveal>
            <Reveal variant="fade" delay={200}>
              <div className="mt-7 space-y-5 text-[17.5px] leading-9 text-ink-muted">
                <p>
                  삶의 무게가 가볍지 않은 시대에 교회는 다시 복음의 소망을 붙들고 이웃 곁으로
                  다가가야 합니다. 영천중앙교회는 예배 안에서 하나님을 만나고, 구역과 다음세대를
                  세우며, 지역 사회를 섬기는 공동체가 되기를 소망합니다.
                </p>
                <p>
                  처음 방문하시는 분도 예배와 교제 안에서 따뜻하게 환대받을 수 있도록 준비하고
                  있습니다. 주일예배, 교회학교, 청춘교실과 여러 모임을 통해 함께 믿음의 길을
                  걸어가겠습니다.
                </p>
              </div>
            </Reveal>
            <Reveal variant="fade-up" delay={280}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/about/serving"
                  className="motion-hover inline-flex items-center rounded-full bg-accent px-6 py-3.5 text-[15px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-accent-deep"
                >
                  섬기는 분들
                </Link>
                <Link
                  href="/about/visit"
                  className="inline-flex items-center rounded-full border-[1.5px] border-line bg-paper px-6 py-3.5 text-[15px] font-bold text-ink transition hover:border-accent hover:text-accent-deep"
                >
                  예배시간·오시는 길
                </Link>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="bg-surface py-20 sm:py-24">
        <Container size="wide">
          <Reveal variant="fade-up">
            <div className="max-w-[720px]">
              <p className="text-[12.5px] font-bold uppercase tracking-[0.28em] text-accent">Vision</p>
              <h2 className="mt-3.5 font-serif text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
                우리가 붙드는 세 가지
              </h2>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {visions.map((vision, i) => (
              <Reveal key={vision.title} variant="fade-up" delay={i * 90}>
                <div className="h-full rounded-2xl border border-line bg-paper p-8 shadow-subtle">
                  <div className="mb-5 flex h-[50px] w-[50px] items-center justify-center rounded-xl bg-accent/10 text-accent-deep">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      {vision.icon}
                    </svg>
                  </div>
                  <h3 className="font-serif text-xl font-extrabold tracking-tight text-ink">{vision.title}</h3>
                  <p className="mt-2.5 text-[15.5px] leading-7 text-ink-muted">{vision.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container size="wide">
          <div className="flex flex-wrap gap-x-12 gap-y-10">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} variant="fade-up" delay={i * 80}>
                <div>
                  <div className="font-serif text-5xl font-extrabold leading-none text-accent-deep">
                    {stat.n}
                    {stat.unit && <span className="text-[0.5em]">{stat.unit}</span>}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-ink-muted">{stat.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>
    </>
  )
}
