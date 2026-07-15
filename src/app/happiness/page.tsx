import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import WorshipSubnav from '@/components/worship/WorshipSubnav'
import Reveal from '@/components/ui/Reveal'

export const metadata: Metadata = {
  title: '행복선언',
  description: '영천중앙교회가 예배 때마다 축도 전에 함께 고백하는 행복선언입니다.',
  alternates: {
    canonical: '/happiness',
  },
}

const confessions = [
  ['예수 안에서', '나는 잘되고 있습니다'],
  ['예수 안에서', '우리 가정은 잘되고 있습니다'],
  ['예수 안에서', '우리 교회는 잘되고 있습니다'],
]

export default function HappinessPage() {
  return (
    <>
      <PageHero
        tone="royal"
        eyebrow="Declaration"
        title="행복선언"
        subtitle="영천중앙교회는 예배 때마다 축도 전에 행복선언을 함께 고백합니다."
      />
      <WorshipSubnav />
      <section className="py-20 sm:py-24">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Reveal variant="fade-up">
              <div className="space-y-6 text-[17.5px] leading-9 text-ink-muted">
                <p>
                  행복선언은 단순한 긍정의 말이나 세상적인 형통을 비는 구호가 아닙니다. 우리의 형편이 늘
                  완벽하다는 뜻도 아닙니다.
                </p>
                <p>
                  이 고백은 예수 그리스도 안에서 하나님의 선하신 통치가 우리의 삶과 가정과 교회 가운데
                  일하고 있으며, 하나님 나라가 오늘 우리의 자리에서 드러나고 있음을 믿음으로 선포하는
                  선언입니다.
                </p>
              </div>
            </Reveal>

            <Reveal variant="fade-up" delay={140}>
              <div className="my-12 grid gap-3.5">
                {confessions.map(([first, second]) => (
                  <p
                    key={second}
                    className="rounded-2xl border border-line-strong bg-card-blue px-7 py-[30px] text-center text-[clamp(20px,2.6vw,25px)] font-extrabold leading-[1.5] tracking-tight text-accent-deep"
                  >
                    {first}
                    <br />
                    {second}
                  </p>
                ))}
              </div>
            </Reveal>

            <Reveal variant="fade-up" delay={220}>
              <div className="space-y-6 text-[17.5px] leading-9 text-ink-muted">
                <p>
                  우리는 이 고백을 통해 예배의 은혜를 삶으로 이어갑니다. 예수 안에서 하나님의 통치를 받고,
                  하나님 나라의 백성으로 살아가며, 우리 삶과 가정과 교회 가운데 주님의 나라가 이루어지기를
                  갈망합니다.
                </p>
              </div>
            </Reveal>

            <Reveal variant="fade-up" delay={300}>
              <figure className="mt-14 border-t border-line pt-10 text-center">
                <blockquote className="text-[clamp(19px,2.4vw,24px)] font-extrabold leading-[1.75] tracking-tight text-accent-deep">
                  먼저
                  <br />
                  그의 나라와 그의 의를 구하라
                  <br />
                  그리하면
                  <br />
                  이 모든 것을
                  <br />
                  너희에게 더하시리라
                </blockquote>
                <figcaption className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-gold-deep">
                  마태복음 6장 33절
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  )
}
