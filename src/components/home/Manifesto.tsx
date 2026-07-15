import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { churchInfo } from '@/lib/church'

// 홈 #2 — 환영 메시지. 흰 단색 배경 + 골드 라인 (페리윙클 제거, PDF 지정 줄바꿈).
export default function Manifesto() {
  return (
    <section className="bg-paper py-28 min-[960px]:py-32">
      <Container size="wide" className="text-center">
        <Reveal>
          <div className="mx-auto h-1 w-14 bg-gold" aria-hidden />
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-9 max-w-[56rem] break-keep text-[clamp(22px,3.2vw,38px)] font-bold leading-[1.6] text-accent-deep">
            오래된 믿음 위에, 새로운 은혜가 머무는
            <br />
            {churchInfo.name}에 오신
            <br />
            여러분 환영합니다
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
