import Link from 'next/link'
import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow } from './HomePrimitives'
import { staticImg } from '@/lib/static-images'

// 홈 #4 — 핵심 진입 3종(말씀/주일학교/찬양). 사진 위 텍스트 오버레이 없음(PDF):
// 상단 사진 + 하단 흰 캡션 영역. 사진은 R2 static/images/entry/*.webp 재업로드로 교체(교회 제공 대기).

interface EntryCard {
  key: string
  title: string
  photo: string
  desc: string
  href: string
  items: string[]
}

const cards: EntryCard[] = [
  {
    key: 'word',
    title: '말씀',
    photo: staticImg('/images/entry/word.webp'),
    desc: '매 예배의 말씀을 다시 듣고 묵상합니다.',
    href: '/sermons',
    items: ['주일예배', '주일찬양예배', '수요예배'],
  },
  {
    key: 'school',
    title: '주일학교',
    photo: staticImg('/images/entry/school.webp'),
    desc: '다음 세대가 말씀 위에 자랍니다.',
    href: '/worship',
    items: ['유치부', '아동부', '중고등부'],
  },
  {
    key: 'praise',
    title: '찬양',
    photo: staticImg('/images/entry/praise.webp'),
    desc: '찬양으로 하나님께 영광을 올려 드립니다.',
    href: '/praise',
    items: ['찬양대', '특송'],
  },
]

export default function EntryCards({ sermonSummary }: { sermonSummary?: string | null }) {
  return (
    <section className="bg-paper py-24 min-[960px]:py-28">
      <Container size="wide">
        <Reveal className="text-center">
          <Eyebrow>Worship · Community</Eyebrow>
          <h2 className="mt-4 text-[clamp(26px,3.4vw,40px)] font-extrabold tracking-tight text-accent-deep">
            함께 예배하고, 함께 자랍니다
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {cards.map((card, i) => {
            const description = card.key === 'word' && sermonSummary ? `“${sermonSummary}”` : card.desc
            return (
              <Reveal key={card.key} delay={80 + i * 80} className="h-full">
                <Link
                  href={card.href}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle transition duration-300 hover:-translate-y-1 hover:shadow-lifted"
                >
                  <div className="relative h-[250px] overflow-hidden">
                    <Image
                      src={card.photo}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 px-7 pb-8 pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[26px] font-extrabold text-accent-deep">{card.title}</h3>
                      <span className="text-xl font-extrabold text-gold-deep" aria-hidden>
                        →
                      </span>
                    </div>
                    <p className="line-clamp-3 text-base leading-[1.7] text-ink-muted">{description}</p>
                    <p className="mt-auto text-[14.5px] font-semibold text-faint">{card.items.join(' · ')}</p>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
