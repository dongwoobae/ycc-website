import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow } from './HomePrimitives'

export default function Verse() {
  return (
    <section className="bg-bg py-28 text-center min-[960px]:py-[150px]">
      <Container size="wide">
        <Reveal>
          <blockquote className="mx-auto max-w-[20ch] font-serif text-[clamp(28px,5vw,58px)] font-extrabold leading-[1.4] tracking-tight text-ink">
            우리가 소망을 가지고 그것을
            <br />
            <span className="text-accent">영혼의 닻</span> 같이 붙잡으니
          </blockquote>
          <Eyebrow className="mt-8">히브리서 6:19</Eyebrow>
        </Reveal>
      </Container>
    </section>
  )
}
