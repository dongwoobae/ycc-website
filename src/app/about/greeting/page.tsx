import type { Metadata } from 'next'
import Image from 'next/image'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import AboutSubnav from '@/components/about/AboutSubnav'
import Reveal from '@/components/ui/Reveal'
import { churchInfo } from '@/lib/church'

export const metadata: Metadata = {
  title: '담임목사 인사말',
  description: `${churchInfo.name} ${churchInfo.seniorPastor.title}의 인사말입니다.`,
  alternates: {
    canonical: '/about/greeting',
  },
}

export default function GreetingPage() {
  return (
    <>
      <PageHero
        eyebrow="Greeting"
        title="담임목사 인사말"
        subtitle={`${churchInfo.name}를 찾아 주신 여러분을 진심으로 환영합니다.`}
      />
      <AboutSubnav />
      <section className="py-20 sm:py-24">
        <Container size="wide">
          <div className="grid gap-12 lg:grid-cols-[320px_1fr] lg:gap-16">
            <Reveal variant="left">
              <figure className="lg:sticky lg:top-28">
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface shadow-subtle">
                  <Image
                    src="/images/staff/pastor-kim-seonchan.webp"
                    alt={`${churchInfo.seniorPastor.name} ${churchInfo.seniorPastor.title}`}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 320px, 100vw"
                    className="object-cover object-top"
                  />
                </div>
                <figcaption className="mt-4 text-center">
                  <p className="text-lg font-extrabold tracking-tight text-ink">{churchInfo.seniorPastor.name} 목사</p>
                  <p className="mt-1 text-sm font-semibold text-ink-muted">{churchInfo.name} {churchInfo.seniorPastor.title}</p>
                </figcaption>
              </figure>
            </Reveal>

            <Reveal variant="right" delay={120}>
              <div className="max-w-[640px] space-y-6 text-[17.5px] leading-9 text-ink-muted">
                <p className="text-[clamp(21px,2.4vw,26px)] font-extrabold leading-[1.55] text-accent-deep">
                  {churchInfo.name} 홈페이지를 방문해 주신
                  <br />
                  여러분을 진심으로 환영합니다.
                </p>
                <p>
                  {churchInfo.name}는 예수 그리스도의 복음 위에 세워진 믿음의 공동체입니다. 우리는 하나님을
                  예배하고, 말씀으로 삶을 세우며, 기도 가운데 주님의 뜻을 구하고, 이웃과 지역을 섬기는
                  교회가 되기를 소망합니다.
                </p>
                <p>
                  영천 땅에서 오랜 시간 예배의 자리를 지켜 온 우리 교회는 모든 세대가 함께 믿음으로
                  자라가며, 다음 세대를 세우고, 가정과 지역사회 안에서 복음의 빛을 드러내는 교회가 되기
                  위해 기도하고 있습니다.
                </p>
                <p>
                  교회는 단순히 모이는 장소가 아니라 하나님의 은혜를 경험하고 삶이 회복되는 믿음의
                  집입니다. 이 홈페이지가 {churchInfo.name}를 알아가는 작은 문이 되고, 예배와 말씀, 교제와
                  섬김의 자리로 이어지는 따뜻한 초대가 되기를 바랍니다.
                </p>
                <p>
                  언제든 {churchInfo.name}로 오십시오. 함께 예배하며 주님의 은혜를 나누기를 소망합니다.
                </p>
                <div className="border-t border-line pt-6 text-right">
                  <p className="text-sm font-semibold text-ink-muted">{churchInfo.name} {churchInfo.seniorPastor.title}</p>
                  <p className="mt-1 text-xl font-extrabold tracking-tight text-ink">{churchInfo.seniorPastor.name} 목사</p>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  )
}
