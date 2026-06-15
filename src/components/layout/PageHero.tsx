import Container from './Container'
import Reveal from '@/components/ui/Reveal'
import HeroBackdrop from './HeroBackdrop'

interface PageHeroProps {
  eyebrow?: string
  title: string
  subtitle?: string
  image: string
}

export default function PageHero({ eyebrow, title, subtitle, image }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-accent-deep to-ink">
      <HeroBackdrop image={image} />
      <Container className="flex min-h-[18rem] flex-col justify-center py-16 md:min-h-[22rem]">
        <Reveal variant="fade">
          {eyebrow && <p className="text-sm font-semibold tracking-wide text-emerald-100">{eyebrow}</p>}
        </Reveal>
        <Reveal variant="fade-up" delay={100}>
          <h1 className="mt-3 font-serif text-4xl font-extrabold leading-tight tracking-tight text-bg sm:text-5xl">
            {title}
          </h1>
        </Reveal>
        {subtitle && (
          <Reveal variant="fade-up" delay={220}>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-bg/85">{subtitle}</p>
          </Reveal>
        )}
      </Container>
    </section>
  )
}
