import Link from 'next/link'
import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow } from './HomePrimitives'

// 홈 #4 — 핵심 진입 3종(말씀/주일학교/찬양). 카드 배경 사진 + 통일된 다크 오버레이.
// 사진은 public/images/entry/{word,school,praise}.webp 를 덮어쓰면 교체됩니다(현재 임시).
// 카드 전체가 하나의 링크(href). 내부 items는 클릭 버튼이 아니라 안내용 나열 텍스트.

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
    photo: '/images/entry/word.webp',
    desc: '매 예배의 말씀을 다시 듣고 묵상합니다.',
    href: '/sermons',
    items: ['주일예배', '주일찬양예배', '수요예배'],
  },
  {
    key: 'school',
    title: '주일학교',
    photo: '/images/entry/school.webp',
    desc: '다음 세대가 말씀 위에 자랍니다.',
    href: '/worship',
    items: ['유치부', '아동부', '중고등부'],
  },
  {
    key: 'praise',
    title: '찬양',
    photo: '/images/entry/praise.webp',
    desc: '찬양으로 하나님께 영광을 올려 드립니다.',
    href: '/praise',
    items: ['찬양대', '특송'],
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
                <Link
                  href={card.href}
                  className="group relative isolate flex h-full min-h-[400px] flex-col justify-end overflow-hidden rounded-xl p-7 text-white min-[960px]:min-h-[460px]"
                >
                  <Image
                    src={card.photo}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="-z-20 object-cover"
                  />
                  <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(15_23_42/0.12)_0%,rgb(15_23_42/0.38)_46%,rgb(15_23_42/0.88)_100%)]" />

                  <h3 className="font-serif text-[26px] font-extrabold tracking-tight underline-offset-4 decoration-2 [text-shadow:0_1px_6px_rgb(15_23_42/0.55)] group-hover:underline">
                    {card.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-white/90">{description}</p>

                  <p className="mt-5 text-[14.5px] leading-7 text-white/80">{card.items.join(' · ')}</p>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
