import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import WorshipSubnav from '@/components/worship/WorshipSubnav'
import Reveal from '@/components/ui/Reveal'
import {
  adultWorshipSchedule,
  nextGenerationWorshipSchedule,
  type WorshipScheduleItem,
} from '@/lib/worship'
import { churchInfo } from '@/lib/church'

export const metadata: Metadata = {
  title: '예배 시간',
  description: `${churchInfo.name} 주일예배·주일학교·청년부·수요예배·새벽예배·금요기도회의 요일과 시간, 장소를 안내합니다.`,
  alternates: {
    canonical: '/worship',
  },
}

const allSchedule: readonly WorshipScheduleItem[] = [
  ...adultWorshipSchedule,
  ...nextGenerationWorshipSchedule,
]

function pick(names: readonly string[]): WorshipScheduleItem[] {
  return names
    .map((name) => allSchedule.find((item) => item.name === name))
    .filter((item): item is WorshipScheduleItem => Boolean(item))
}

interface WorshipSectionData {
  id: string
  title: string
  description?: string
  rows: WorshipScheduleItem[]
}

const sections: WorshipSectionData[] = [
  {
    id: 'sunday',
    title: '주일예배',
    description: '한 주의 첫날, 온 성도가 함께 하나님께 드리는 예배입니다.',
    rows: pick(['주일예배', '찬양예배']),
  },
  {
    id: 'school',
    title: '주일학교',
    rows: pick(['유치부', '아동부', '중·고등부']),
  },
  {
    id: 'youth',
    title: '청년부',
    description: '청년들이 말씀과 교제로 신앙을 세워가는 예배입니다.',
    rows: pick(['청년부']),
  },
  {
    id: 'wednesday',
    title: '수요예배',
    description: '주중에 말씀으로 마음을 다시 세우는 예배입니다.',
    rows: pick(['수요예배']),
  },
  {
    id: 'dawn',
    title: '새벽예배',
    description: '하루를 말씀과 기도로 여는 새벽기도회입니다.',
    rows: pick(['새벽기도']),
  },
  {
    id: 'friday',
    title: '금요기도회',
    description: '매월 첫째 금요일, 함께 모여 기도하는 시간입니다.',
    rows: pick(['금요기도회']),
  },
  {
    id: 'others',
    title: '그 외 모임',
    description: '연령과 상황에 맞게 함께 모이는 모임입니다.',
    rows: pick(['청춘교실']),
  },
]

function ScheduleRow({ item }: { item: WorshipScheduleItem }) {
  return (
    <div className="grid items-baseline gap-x-3.5 gap-y-1 border-b border-line-soft py-[15px] last:border-b-0 sm:grid-cols-[8rem_1fr_auto]">
      <strong className="text-[17px] font-bold text-accent-deep">{item.name}</strong>
      <span className="text-[14.5px] text-faint-soft">{item.place}</span>
      <span className="text-[15px] font-extrabold text-gold-deep sm:justify-self-end sm:whitespace-nowrap">
        {item.displayTime}
      </span>
    </div>
  )
}

export default function WorshipPage() {
  return (
    <>
      <PageHero
        tone="beige"
        eyebrow="Guide"
        title="예배 시간"
        subtitle={`${churchInfo.name}의 예배와 모임을 요일·시간·장소와 함께 안내합니다.`}
      />
      <WorshipSubnav />
      <div className="py-20 sm:py-24">
        <Container size="wide">
          <div className="grid gap-6 md:grid-cols-2">
            {sections.map((section, i) => (
              <Reveal key={section.id} variant="fade-up" delay={(i % 2) * 90}>
                <section
                  id={section.id}
                  className="h-full scroll-mt-28 rounded-2xl border border-line bg-paper p-8 shadow-subtle"
                >
                  <h2 className="text-2xl font-extrabold tracking-tight text-accent-deep">{section.title}</h2>
                  {section.description && (
                    <p className="mt-2 text-[14.5px] leading-6 text-ink-muted">{section.description}</p>
                  )}
                  <div className="mt-4">
                    {section.rows.map((item) => (
                      <ScheduleRow key={item.name} item={item} />
                    ))}
                  </div>
                </section>
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </>
  )
}
