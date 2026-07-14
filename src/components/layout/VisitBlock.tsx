import type { ReactNode } from 'react'
import Container from '@/components/layout/Container'
import PastorKakaoCard from '@/components/layout/PastorKakaoCard'
import Reveal from '@/components/ui/Reveal'
import { ImagePlaceholder } from '@/components/home/HomePrimitives'
import { churchInfo } from '@/lib/church'

const kakaoMapUrl = `https://map.kakao.com/?q=${encodeURIComponent(churchInfo.address)}`

interface VisitBlockProps {
  eyebrow: ReactNode
  title: ReactNode
  description?: ReactNode
  media: ReactNode
  details?: ReactNode
  showPastorKakao?: boolean
  className?: string
}

export default function VisitBlock({
  eyebrow,
  title,
  description,
  media,
  details,
  showPastorKakao = false,
  className = 'bg-surface py-20 min-[960px]:py-28',
}: VisitBlockProps) {
  return (
    <section id="visit" className={`scroll-mt-28 ${className}`}>
      <Container size="wide">
        <Reveal>
          <div>
            <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
            <h2 className="mt-4 text-[clamp(30px,4.4vw,52px)] font-extrabold leading-tight tracking-tight text-ink">
              {title}
            </h2>
            {description ? <p className="mt-4 max-w-2xl leading-7 text-ink-muted">{description}</p> : null}
          </div>
        </Reveal>
        <div className="mt-12 grid gap-10 min-[960px]:grid-cols-[1.05fr_0.95fr]">
          <Reveal>{media}</Reveal>
          <Reveal delay={120}>
            <div className="grid gap-6">
              <VisitInfo label="Address">
                <address className="font-serif text-[23px] font-bold not-italic leading-8 text-ink">{churchInfo.address}</address>
              </VisitInfo>
              <div className="h-52 overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle">
                <ImagePlaceholder label="교회 사진" />
              </div>
              {details}
              <VisitInfo label="Contact" last={!showPastorKakao}>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`tel:${churchInfo.phone}`}
                    className="motion-hover rounded-full border border-line bg-paper px-5 py-3 text-sm font-bold text-ink transition hover:border-accent"
                  >
                    Phone {churchInfo.phone}
                  </a>
                  <a
                    href={churchInfo.blog}
                    target="_blank"
                    rel="noreferrer"
                    className="motion-hover rounded-full border border-line bg-paper px-5 py-3 text-sm font-bold text-ink transition hover:border-accent"
                  >
                    Blog
                  </a>
                  <a
                    href={kakaoMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="motion-hover rounded-full border border-[#FEE500] bg-[#FEE500] px-5 py-3 text-sm font-bold text-[#3a2929] transition hover:brightness-95"
                  >
                    카카오맵 길찾기
                  </a>
                </div>
              </VisitInfo>
              {showPastorKakao ? <PastorKakaoCard /> : null}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}

export function VisitInfo({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={last ? '' : 'border-b border-line pb-6'}>
      <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}
