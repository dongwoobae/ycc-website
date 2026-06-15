import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import Reveal from '@/components/ui/Reveal'

export const metadata: Metadata = {
  title: '섬기는 분들',
}

const groups = [
  { title: '교역자', people: ['담임 목사 김선찬', '전임전도사 김지희', '교육전도사 이지형', '교육전도사 정다슬'] },
  { title: '장로', people: ['원로장로 배윤호 김대식', '은퇴장로 배성일 허민구 이규락', '협동은퇴장로 최원필 조남수', '시무장로 박상현 조제혁 조재문 정익환'] },
  { title: '예배 섬김', people: ['지휘자 권기범', '반주자 임현선 엄지혜 박민아'] },
  { title: '선교지', people: ['라오스 이종원·김은영', '캄보디아 고성탁', '제주온유한교회 문지덕', '속초더함교회 최만석'] },
]

export default function ServingPage() {
  return (
    <>
      <PageHero
        eyebrow="People"
        title="섬기는 분들"
        subtitle="말씀과 예배, 다음세대와 선교의 자리에서 교회를 섬기는 분들입니다."
        image="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1600&q=80"
      />
      <div className="py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {groups.map((group, i) => (
              <Reveal key={group.title} variant="zoom" delay={i * 90}>
                <section className="h-full rounded-lg border border-line bg-paper p-6 shadow-subtle transition hover:-translate-y-1 hover:shadow-soft">
                  <h2 className="font-serif text-2xl text-ink">{group.title}</h2>
                  <ul className="mt-5 space-y-3 text-ink-muted">
                    {group.people.map((person) => (
                      <li key={person} className="border-b border-line pb-3 last:border-b-0">
                        {person}
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
