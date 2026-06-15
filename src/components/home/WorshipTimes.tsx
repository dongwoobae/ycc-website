import Container from '@/components/layout/Container'
import SectionTitle from '@/components/ui/SectionTitle'
import Reveal from '@/components/ui/Reveal'

const worshipCards = [
  { name: '찬양예배', time: '오후 2:00', note: '주일' },
  { name: '수요예배', time: '오후 7:30', note: '수요일' },
  { name: '새벽기도', time: '오전 5:00', note: '화-주일' },
  { name: '다음세대 예배', time: '주일 11:00', note: '유치부 · 아동부 · 중고등부' },
]

export default function WorshipTimes() {
  return (
    <section id="worship" className="bg-surface py-24 min-[960px]:py-32">
      <Container size="wide">
        <Reveal>
          <SectionTitle eyebrow="Worship" title="예배 시간" description="매주 같은 자리에서 당신을 기다립니다." />
        </Reveal>
        <div className="mt-12 grid gap-5 min-[960px]:grid-cols-2">
          <Reveal className="min-[960px]:col-span-2">
            <article className="motion-hover flex flex-col gap-5 rounded-[18px] border border-line bg-[linear-gradient(120deg,rgb(var(--paper)),oklch(0.91_0.05_245))] p-8 transition hover:-translate-y-1 hover:border-accent min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
              <div>
                <p className="text-2xl font-bold text-ink">주일예배</p>
                <p className="mt-2 text-sm text-faint">온 가족이 함께 드리는 주일예배 · 본당</p>
              </div>
              <p className="font-serif text-[clamp(38px,5vw,60px)] font-extrabold leading-tight text-accent">
                주일 오전 11:00
              </p>
            </article>
          </Reveal>
          {worshipCards.map((card, index) => (
            <Reveal key={card.name} delay={index * 80}>
              <article className="motion-hover h-full rounded-[18px] border border-line bg-paper p-8 transition hover:-translate-y-1 hover:border-accent">
                <h3 className="text-xl font-bold text-ink">{card.name}</h3>
                <p className="mt-3 font-serif text-3xl font-extrabold text-accent">{card.time}</p>
                <p className="mt-2 text-sm text-faint">{card.note}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
