import type { Metadata } from 'next'
import Image from 'next/image'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import AboutSubnav from '@/components/about/AboutSubnav'
import Reveal from '@/components/ui/Reveal'

export const metadata: Metadata = {
  title: '섬기는 분들',
  description: '영천중앙교회를 섬기는 교역자와 사역자를 소개합니다.',
  alternates: {
    canonical: '/about/serving',
  },
}

const staff: { role: string; name: string; photo: string }[] = [
  { role: '담임목사', name: '김선찬', photo: '/images/staff/pastor-kim-seonchan.webp' },
  { role: '전임전도사', name: '김지희', photo: '/images/staff/evangelist-kim-jihee.webp' },
  { role: '교육전도사', name: '이지형', photo: '/images/staff/evangelist-lee-jihyung.webp' },
  { role: '교육전도사', name: '정다슬', photo: '/images/staff/evangelist-jung-daseul.webp' },
]

const groups: { title: string; rows: { role: string; names: string }[] }[] = [
  {
    title: '장로',
    rows: [
      { role: '원로장로', names: '배윤호 · 김대식' },
      { role: '은퇴장로', names: '배성일 · 허민구 · 이규락' },
      { role: '협동은퇴장로', names: '최원필 · 조남수' },
      { role: '시무장로', names: '박상현 · 조제혁 · 조재문 · 정익환' },
    ],
  },
  {
    title: '예배 섬김',
    rows: [
      { role: '지휘자', names: '권기범' },
      { role: '반주자', names: '임현선 · 엄지혜 · 박민아' },
    ],
  },
  {
    title: '선교지',
    rows: [
      { role: '라오스', names: '이종원 · 김은영' },
      { role: '캄보디아', names: '고성탁' },
      { role: '제주 온유한교회', names: '문지덕' },
      { role: '속초 더함교회', names: '최만석' },
    ],
  },
]

export default function ServingPage() {
  return (
    <>
      <PageHero
        eyebrow="People"
        title="섬기는 분들"
        subtitle="말씀과 예배, 다음세대와 선교의 자리에서 교회를 섬기는 분들입니다."
      />
      <AboutSubnav />
      <div className="py-20 sm:py-24">
        <Container size="wide">
          <section>
            <Reveal>
              <h2 className="flex items-center gap-3 font-serif text-2xl font-extrabold tracking-tight text-ink">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
                교역자
              </h2>
            </Reveal>
            <div className="mt-6 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
              {staff.map((person, i) => (
                <Reveal key={`${person.role}-${person.name}`} variant="zoom" delay={i * 80}>
                  <figure className="overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle transition hover:-translate-y-1 hover:shadow-lifted">
                    <div className="relative aspect-[3/4] bg-surface">
                      <Image
                        src={person.photo}
                        alt={`${person.role} ${person.name}`}
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="object-cover object-top"
                      />
                    </div>
                    <figcaption className="px-4 py-4 text-center">
                      <p className="text-[13px] font-semibold text-ink-muted">{person.role}</p>
                      <p className="mt-1 font-serif text-lg font-extrabold tracking-tight text-ink">{person.name}</p>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </section>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {groups.map((group, i) => (
              <Reveal key={group.title} variant="zoom" delay={i * 90}>
                <section className="h-full rounded-2xl border border-line bg-paper p-8 shadow-subtle transition hover:-translate-y-1 hover:shadow-lifted">
                  <h2 className="flex items-center gap-3 font-serif text-2xl font-extrabold tracking-tight text-ink">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
                    {group.title}
                  </h2>
                  <ul className="mt-5">
                    {group.rows.map((row, idx) => (
                      <li
                        key={`${row.role}-${idx}`}
                        className="border-b border-line py-3.5 text-base text-ink-muted last:border-b-0"
                      >
                        <b className="mr-2 font-serif font-bold text-ink">{row.role}</b>
                        {row.names}
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
