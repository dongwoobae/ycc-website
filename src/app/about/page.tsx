import type { Metadata } from 'next'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import Reveal from '@/components/ui/Reveal'

export const metadata: Metadata = {
  title: '교회소개',
}

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Welcome"
        title="교회소개"
        subtitle="영천중앙교회는 1956년 창립 이후 말씀과 예배, 선교와 섬김으로 지역 사회와 함께 걸어왔습니다."
        image="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="py-16">
        <Container className="max-w-3xl">
          <Reveal variant="fade">
            <h2 className="font-serif text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
              처음 오신 분도 편안히 머물 수 있는 교회
            </h2>
          </Reveal>
          <Reveal variant="fade" delay={120}>
            <div className="mt-8 space-y-6 text-lg leading-9 text-ink-muted">
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
          <Reveal variant="fade-up" delay={220}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/about/serving" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-bg transition hover:bg-accent-deep">
                섬기는 분들
              </Link>
              <Link
                href="/about/visit"
                className="rounded-full border border-line bg-paper px-5 py-3 text-sm font-semibold text-ink transition hover:bg-surface"
              >
                예배시간·오시는 길
              </Link>
            </div>
          </Reveal>
        </Container>
      </div>
    </>
  )
}
