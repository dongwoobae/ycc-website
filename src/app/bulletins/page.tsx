import type { Metadata } from 'next'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import BulletinsHero from '@/components/bulletins/BulletinsHero'
import Reveal from '@/components/ui/Reveal'
import { getBulletins } from '@/lib/data/bulletins'

export const metadata: Metadata = {
  title: '주보',
}

export const revalidate = 3600

export default async function BulletinsPage() {
  const bulletins = await getBulletins()

  return (
    <>
      <BulletinsHero />
      <div className="py-20 sm:py-24">
        <Container size="wide">
          <div className="grid gap-6 md:grid-cols-2">
            {bulletins.map((bulletin, i) => (
              <Reveal key={bulletin.id} variant="fade-up" delay={(i % 2) * 100}>
                <Link
                  href={`/bulletins/${bulletin.id}`}
                  className="group relative block h-full overflow-hidden rounded-2xl border border-line bg-paper p-8 shadow-subtle transition hover:-translate-y-1 hover:shadow-lifted"
                >
                  <span className="pointer-events-none absolute -right-[30px] -top-[30px] h-[110px] w-[110px] rounded-full bg-accent/15 opacity-60 transition duration-300 group-hover:scale-125" />
                  <span className="relative z-[1] mb-[18px] flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-line bg-bg text-accent-deep">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </span>
                  <p className="relative z-[1] text-[13.5px] font-bold text-accent-deep">
                    {bulletin.volume} {bulletin.issue}
                  </p>
                  <h2 className="relative z-[1] mt-2.5 font-serif text-3xl font-extrabold tracking-tight text-ink">
                    {bulletin.bulletinDate} 주보
                  </h2>
                  <p className="relative z-[1] mt-4 font-semibold text-ink">{bulletin.theme}</p>
                  <p className="relative z-[1] mt-1.5 text-sm text-faint">({bulletin.scripture})</p>
                  <span className="relative z-[1] mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent-deep">
                    주보 보기 →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
