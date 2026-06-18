import Container from '@/components/layout/Container'
import KakaoMap from '@/components/layout/KakaoMap'
import Reveal from '@/components/ui/Reveal'
import { churchInfo } from '@/lib/church'
import { Eyebrow } from './HomePrimitives'
import type { ReactNode } from 'react'

export default function Visit() {
  return (
    <section id="visit" className="bg-surface py-24 min-[960px]:py-32">
      <Container size="wide">
        <Reveal>
          <Eyebrow>Visit us</Eyebrow>
          <h2 className="mt-4 text-[clamp(30px,4.4vw,52px)] font-extrabold leading-tight tracking-tight text-ink">
            오시는 <span className="text-accent">길</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-10 min-[960px]:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <div className="min-h-[380px] overflow-hidden rounded-[20px] border border-line bg-surface">
              <KakaoMap />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="grid gap-6">
              <Info label="Address">
                <address className="font-serif text-[23px] font-bold not-italic leading-8 text-ink">{churchInfo.address}</address>
              </Info>
              <Info label="Parking">
                <p className="font-semibold leading-7 text-ink-muted">교회 주차장 이용 · 주일에는 안내위원이 안내해드립니다</p>
              </Info>
              <Info label="Contact" last>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`tel:${churchInfo.phone}`}
                    className="motion-hover rounded-full border border-line bg-paper px-5 py-3 text-sm font-bold text-ink transition hover:border-accent"
                  >
                    전화 {churchInfo.phone}
                  </a>
                  <a
                    href={churchInfo.blog}
                    className="motion-hover rounded-full border border-[#FEE500] bg-[#FEE500] px-5 py-3 text-sm font-bold text-[#3a2929] transition hover:-translate-y-0.5"
                  >
                    카카오톡 문의
                  </a>
                </div>
              </Info>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}

function Info({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={last ? '' : 'border-b border-line pb-6'}>
      <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}
