import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import AboutSubnav from '@/components/about/AboutSubnav'
import KakaoMap from '@/components/layout/KakaoMap'
import PastorKakaoCard from '@/components/layout/PastorKakaoCard'
import Reveal from '@/components/ui/Reveal'
import { churchInfo } from '@/lib/church'
import { adultWorshipSchedule, nextGenerationWorshipSchedule, type WorshipScheduleItem } from '@/lib/worship'

export const metadata: Metadata = {
  title: '예배시간·오시는 길',
}

function ScheduleTable({ title, rows }: { title: string; rows: readonly WorshipScheduleItem[] }) {
  return (
    <section className="h-full rounded-2xl border border-line bg-paper p-8 shadow-subtle">
      <h2 className="font-serif text-[23px] font-extrabold tracking-tight text-ink">{title}</h2>
      <div className="mt-3.5">
        {rows.map(({ name, place, displayTime }) => (
          <div
            key={name}
            className="grid items-baseline gap-x-3.5 gap-y-1 border-b border-line py-[15px] last:border-b-0 sm:grid-cols-[7rem_1fr_auto]"
          >
            <strong className="font-serif text-[17px] font-bold text-ink">{name}</strong>
            <span className="text-[14.5px] text-faint">{place}</span>
            <span className="text-[15px] font-bold text-accent-deep sm:justify-self-end sm:whitespace-nowrap">
              {displayTime}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function VisitPage() {
  const kakaoMapUrl = `https://map.kakao.com/?q=${encodeURIComponent(churchInfo.address)}`

  return (
    <>
      <PageHero
        eyebrow="Visit"
        title="예배시간·오시는 길"
        subtitle="처음 방문하시는 분은 주일 오전 11시 본당 예배에 오시면 안내를 받으실 수 있습니다."
        image="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=80"
      />
      <AboutSubnav />
      <div className="py-20 sm:py-24">
        <Container size="wide">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <Reveal variant="fade-up">
              <ScheduleTable title="장년부 예배 및 모임" rows={adultWorshipSchedule} />
            </Reveal>
            <Reveal variant="fade-up" delay={120}>
              <ScheduleTable title="교회학교" rows={nextGenerationWorshipSchedule} />
            </Reveal>
          </div>

          <Reveal variant="fade-up" delay={120}>
            <section className="mt-6 grid overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle lg:grid-cols-[0.85fr_1.15fr]">
              <div className="p-9">
                <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">오시는 길</h2>
                <p className="mt-4 text-[17px] font-semibold text-ink">{churchInfo.address}</p>
                <p className="mt-2 text-[15px] text-ink-muted">
                  전화 {churchInfo.phone} · {churchInfo.phone2}
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <a
                    href={`tel:${churchInfo.phone}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-5 py-3 text-[15px] font-bold text-ink transition hover:border-accent"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    전화하기
                  </a>
                  <a
                    href={kakaoMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[#FEE500] bg-[#FEE500] px-5 py-3 text-[15px] font-bold text-[#3a2929] transition hover:brightness-95"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.6-.2.7-.7 2.6-.8 3 0 0-.02.2.1.27.12.08.27.02.27.02.36-.05 2.8-1.85 3.4-2.27.7.1 1.5.15 2.3.15 5.5 0 10-3.5 10-7.8S17.5 3 12 3z" />
                    </svg>
                    카카오맵 길찾기
                  </a>
                </div>
                <div className="mt-6">
                  <PastorKakaoCard />
                </div>
              </div>
              <div className="min-h-[300px] bg-surface">
                <KakaoMap />
              </div>
            </section>
          </Reveal>
        </Container>
      </div>
    </>
  )
}
