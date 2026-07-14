import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'

export default function ImmersiveHero() {
  return (
    <section className="relative isolate flex min-h-[620px] h-[100svh] items-end overflow-hidden bg-[linear-gradient(145deg,rgb(var(--moon))_0%,rgb(var(--dawn))_58%,rgb(var(--porcelain))_100%)] text-ink">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_16%,rgb(var(--sky)/0.68),transparent_36%),radial-gradient(circle_at_86%_24%,rgb(var(--china)/0.28),transparent_34%),linear-gradient(180deg,transparent_0%,rgb(var(--moon)/0.72)_100%)]" />
      <Container size="wide" className="pb-24 pt-32 min-[960px]:px-10 min-[960px]:pb-28">
        <div className="min-[960px]:ml-auto min-[960px]:max-w-2xl min-[960px]:text-right">
          <Reveal delay={120}>
            <h1 className="mt-6 font-extrabold leading-[1.05] tracking-tight text-accent-deep">
              <span className="block text-[clamp(18px,3vw,30px)] font-bold tracking-[0.14em] text-ink-muted">
                Welcome to
              </span>
              <span className="mt-2 block text-[clamp(46px,9vw,112px)]">영천중앙교회</span>
            </h1>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
