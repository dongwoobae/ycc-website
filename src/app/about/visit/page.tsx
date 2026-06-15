import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import Reveal from '@/components/ui/Reveal'
import { churchInfo } from '@/lib/church'

export const metadata: Metadata = {
  title: '예배시간·오시는 길',
}

const schedules = [
  ['주일예배', '본당', '주일 오전 11시'],
  ['찬양예배', '본당', '주일 오후 2시'],
  ['수요예배', '본당', '수요일 오후 7시 30분'],
  ['새벽기도', '본당', '화-주일 오전 5시'],
  ['청춘교실', '유치부실', '금요일 오전 10시'],
  ['금요기도회', '본당', '매월 첫째 금요일 오후 7시 30분'],
]

const schools = [
  ['영아부', '유치부실', '주일 오전 9시'],
  ['유치부', '유치부실', '주일 오전 9시'],
  ['아동부', '선교관 1층', '주일 오전 9시'],
  ['중등부', '선교관 지하', '주일 오전 9시'],
  ['고등부', '선교관 지하', '주일 오전 9시'],
  ['청년부', '청년부실', '주일 오후 2시'],
]

export default function VisitPage() {
  return (
    <>
      <PageHero
        eyebrow="Visit"
        title="예배시간·오시는 길"
        subtitle="처음 방문하시는 분은 주일 오전 11시 본당 예배에 오시면 안내를 받으실 수 있습니다."
        image="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="py-16">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <Reveal variant="fade-up">
              <section className="h-full rounded-lg border border-line bg-paper p-6 shadow-subtle">
                <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">장년부 예배 및 모임</h2>
                <div className="mt-5 divide-y divide-line">
                  {schedules.map(([name, place, time]) => (
                    <div key={name} className="grid gap-2 py-4 sm:grid-cols-[7rem_1fr_1fr]">
                      <strong className="text-ink">{name}</strong>
                      <span className="text-ink-muted">{place}</span>
                      <span className="text-ink-muted">{time}</span>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
            <Reveal variant="fade-up" delay={120}>
              <section className="h-full rounded-lg border border-line bg-paper p-6 shadow-subtle">
                <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">교회학교</h2>
                <div className="mt-5 divide-y divide-line">
                  {schools.map(([name, place, time]) => (
                    <div key={name} className="grid gap-2 py-4 sm:grid-cols-[6rem_1fr_1fr]">
                      <strong className="text-ink">{name}</strong>
                      <span className="text-ink-muted">{place}</span>
                      <span className="text-ink-muted">{time}</span>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
          </div>
          <Reveal variant="fade-up" delay={120}>
            <section className="mt-8 grid gap-6 rounded-lg border border-line bg-paper p-6 shadow-subtle lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">오시는 길</h2>
                <p className="mt-4 leading-7 text-ink-muted">{churchInfo.address}</p>
                <p className="mt-2 text-ink-muted">전화 {churchInfo.phone}, {churchInfo.phone2}</p>
              </div>
              <div className="flex aspect-video items-center justify-center rounded-lg bg-surface text-center text-sm leading-6 text-ink-muted">
                카카오맵 임베드 영역
              </div>
            </section>
          </Reveal>
        </Container>
      </div>
    </>
  )
}
