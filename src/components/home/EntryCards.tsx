import Link from 'next/link'
import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow } from './HomePrimitives'

// 홈 #4 — 핵심 진입 3종(말씀/주일학교/찬양). 카드 배경 사진 + 통일된 다크 오버레이.
// 사진은 public/images/entry/{word,school,praise}.webp 를 덮어쓰면 교체됩니다(현재 임시).
// 말씀 하위 = /sermons?worship= 딥링크(기존 필터·영상 재사용). 주일학교·찬양은 라벨만(부서 페이지는 추후).

interface EntryLink {
  label: string
  href: string
}

interface EntryCard {
  key: string
  title: string
  photo: string
  desc: string
  links?: EntryLink[]
  pills?: string[]
}

const cards: EntryCard[] = [
  {
    key: 'word',
    title: '말씀',
    photo: '/images/entry/word.webp',
    desc: '매 예배의 말씀을 다시 듣고 묵상합니다.',
    links: [
      { label: '주일예배', href: '/sermons?worship=주일예배' },
      { label: '주일찬양예배', href: '/sermons?worship=주일찬양예배' },
      { label: '수요예배', href: '/sermons?worship=수요예배' },
    ],
  },
  {
    key: 'school',
    title: '주일학교',
    photo: '/images/entry/school.webp',
    desc: '다음 세대가 말씀 위에 자랍니다.',
    pills: ['유치부', '아동부', '중고등부'],
  },
  {
    key: 'praise',
    title: '찬양',
    photo: '/images/entry/praise.webp',
    desc: '찬양으로 하나님께 영광을 올려 드립니다.',
    pills: ['시온찬양대', '할렐루야찬양대', '호산나찬양대'],
  },
]

export default function EntryCards({ sermonSummary }: { sermonSummary?: string | null }) {
  return (
    <section className="bg-bg py-20 min-[960px]:py-28">
      <Container size="wide">
        <Reveal className="text-center">
          <Eyebrow>Worship · Community</Eyebrow>
          <h2 className="mt-4 text-[clamp(26px,3.4vw,40px)] font-extrabold tracking-tight text-ink">
            함께 예배하고, 함께 자랍니다
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map((card, i) => {
            const description = card.key === 'word' && sermonSummary ? `“${sermonSummary}”` : card.desc
            return (
              <Reveal key={card.key} delay={80 + i * 80} className="h-full">
                <article className="group relative isolate flex h-full min-h-[400px] flex-col justify-end overflow-hidden rounded-3xl p-7 text-white shadow-soft min-[960px]:min-h-[460px]">
                  <Image
                    src={card.photo}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="-z-20 object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(15_23_42/0.12)_0%,rgb(15_23_42/0.38)_46%,rgb(15_23_42/0.88)_100%)]" />

                  <h3 className="font-serif text-[26px] font-extrabold tracking-tight [text-shadow:0_2px_18px_rgb(15_23_42/0.5)]">
                    {card.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-white/90">{description}</p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {card.links
                      ? card.links.map((link) => (
                          <Link
                            key={link.label}
                            href={link.href}
                            className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[13.5px] font-bold backdrop-blur-sm transition hover:bg-white/25"
                          >
                            {link.label}
                          </Link>
                        ))
                      : card.pills?.map((label) => (
                          <span
                            key={label}
                            className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[13.5px] font-bold text-white/90 backdrop-blur-sm"
                          >
                            {label}
                          </span>
                        ))}
                  </div>
                </article>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
