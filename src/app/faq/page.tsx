import type { Metadata } from 'next'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import PageHero from '@/components/layout/PageHero'
import Reveal from '@/components/ui/Reveal'
import { churchInfo, churchPhoneDisplay } from '@/lib/church'

export const metadata: Metadata = {
  title: 'FAQ · 자주 묻는 질문',
  description: '영천중앙교회에 처음 오시는 분들이 자주 묻는 질문과 답변을 모았습니다.',
  alternates: {
    canonical: '/faq',
  },
}

interface FaqItem {
  question: string
  answer: string
}

interface FaqGroup {
  title: string
  items: FaqItem[]
}

const groups: FaqGroup[] = [
  {
    title: '처음 방문',
    items: [
      {
        question: '복장은 어떻게 입고 가면 되나요?',
        answer: '정장이 아니어도 괜찮습니다. 평소에 입는 단정하고 편한 옷이면 충분합니다.',
      },
      {
        question: '예배는 몇 시에 드리나요?',
        answer:
          '주일예배는 주일 오전 11시, 찬양예배는 주일 오후 2시에 본당에서 드립니다. 수요예배는 수요일 오후 7시 30분, 새벽기도회는 화요일부터 주일까지 오전 5시에 있습니다.',
      },
      {
        question: '몇 시까지 도착하면 좋을까요?',
        answer:
          '주일예배는 오전 11시에 시작합니다. 처음 오시는 분은 10분 정도 일찍 오시면 안내를 받고 자리에 앉기 좋습니다.',
      },
      {
        question: '예배는 얼마나 걸리나요?',
        answer: '주일예배는 찬양, 기도, 설교를 포함해 약 70분 정도 진행됩니다.',
      },
      {
        question: '주차는 가능한가요?',
        answer: '교회 주차 공간을 이용하실 수 있습니다. 주일에는 안내위원이 주차 위치를 도와드립니다.',
      },
      {
        question: '헌금은 꼭 해야 하나요?',
        answer: '처음 오신 분께 헌금을 강요하지 않습니다. 예배에 편안한 마음으로 참여하시면 됩니다.',
      },
    ],
  },
  {
    title: '자녀 · 다음세대',
    items: [
      {
        question: '아이와 함께 가도 되나요?',
        answer:
          '물론입니다. 유치부·아동부·중고등부 모임이 준비되어 있어 자녀 연령에 맞게 안내해드립니다.',
      },
      {
        question: '주일학교는 몇 시에 모이나요?',
        answer:
          '유치부·아동부·중고등부는 주일 오전 9시에 각 부서실에서 모입니다. 청년부는 주일 오후 2시에 청년부실에서 모입니다.',
      },
    ],
  },
  {
    title: '위치 · 연락',
    items: [
      {
        question: '교회는 어디에 있나요?',
        answer: `${churchInfo.address}에 있습니다. 자세한 위치와 지도는 ‘처음 오셨나요? › 교회 지도’에서 확인하실 수 있습니다.`,
      },
      {
        question: '문의는 어디로 하면 되나요?',
        answer: `교회 사무실 ${churchPhoneDisplay}으로 전화 주시면 친절히 안내해드립니다.`,
      },
    ],
  },
]

function FaqAccordion({ item, open }: { item: FaqItem; open: boolean }) {
  return (
    <details open={open} className="group overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-lg font-bold text-ink marker:hidden sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>{item.question}</span>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xl leading-none text-accent transition group-open:rotate-45"
          aria-hidden
        >
          +
        </span>
      </summary>
      <p className="px-5 pb-6 leading-7 text-ink-muted sm:px-6">{item.answer}</p>
    </details>
  )
}

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="자주 묻는 질문"
        subtitle="영천중앙교회에 처음 오시는 분들이 자주 묻는 질문을 모았습니다."
      />
      <section className="py-20 sm:py-24">
        <Container>
          <div className="mx-auto max-w-3xl space-y-12">
            {groups.map((group, gi) => (
              <div key={group.title}>
                <Reveal>
                  <h2 className="mb-5 text-2xl font-extrabold tracking-tight text-ink">{group.title}</h2>
                </Reveal>
                <div className="grid gap-3.5">
                  {group.items.map((item, i) => (
                    <Reveal key={item.question} delay={i * 55}>
                      <FaqAccordion item={item} open={gi === 0 && i === 0} />
                    </Reveal>
                  ))}
                </div>
              </div>
            ))}

            <Reveal>
              <p className="text-center text-[15px] leading-7 text-ink-muted">
                더 궁금한 점이 있으신가요? <Link href="/worship" className="font-bold text-accent-deep underline-offset-4 hover:underline">예배 시간</Link>
                와 <Link href="/newfamily#visit" className="font-bold text-accent-deep underline-offset-4 hover:underline">오시는 길</Link>
                도 함께 확인해 보세요.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  )
}
