import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import KakaoMap from '@/components/layout/KakaoMap'
import VisitBlock from '@/components/layout/VisitBlock'
import Reveal from '@/components/ui/Reveal'
import SectionTitle from '@/components/ui/SectionTitle'
import { HomeButton } from '@/components/home/HomePrimitives'
import { churchInfo } from '@/lib/church'
import { adultWorshipSchedule } from '@/lib/worship'

export const metadata: Metadata = {
  title: '처음 오세요',
  description: '영천중앙교회에 처음 방문하는 분들을 위한 예배 안내, FAQ, 다음세대, 오시는 길 안내입니다.',
  alternates: {
    canonical: '/newfamily',
  },
}

const timeline = [
  {
    title: '도착 & 환영',
    time: '예배 10분 전',
    body: '입구에서 안내위원이 반갑게 맞이하고 예배실과 자리를 안내해드립니다. 처음 오셨다고 편하게 말씀해 주세요.',
  },
  {
    title: '찬양과 기도',
    time: '예배 시작',
    body: '함께 찬양하고 기도하며 마음을 엽니다. 익숙하지 않으셔도 앉아서 조용히 함께하셔도 괜찮습니다.',
  },
  {
    title: '설교',
    time: '말씀',
    body: '성경 말씀을 삶의 언어로 나눕니다. 처음 듣는 분도 따라올 수 있도록 차분하게 전합니다.',
  },
  {
    title: '축복과 교제',
    time: '예배 후',
    body: '예배를 마치고 인사와 안내를 나눕니다. 부담 없이 머무르셔도, 조용히 돌아가셔도 괜찮습니다.',
  },
]

const faqs = [
  {
    question: '복장은 어떻게 입고 가면 되나요?',
    answer: '정장이 아니어도 괜찮습니다. 평소에 입는 단정하고 편한 옷이면 충분합니다.',
  },
  {
    question: '몇 시까지 도착하면 좋을까요?',
    answer: '주일예배는 오전 11시에 시작합니다. 처음 오시는 분은 10분 정도 일찍 오시면 안내를 받고 자리에 앉기 좋습니다.',
  },
  {
    question: '주차는 가능한가요?',
    answer: '교회 주차 공간을 이용하실 수 있습니다. 주일에는 안내위원이 주차 위치를 도와드립니다.',
  },
  {
    question: '아이와 함께 가도 되나요?',
    answer: '물론입니다. 유치부, 아동부, 중·고등부 모임이 준비되어 있어 자녀 연령에 맞게 안내해드립니다.',
  },
  {
    question: '헌금은 꼭 해야 하나요?',
    answer: '처음 오신 분께 헌금을 강요하지 않습니다. 예배에 편안한 마음으로 참여하시면 됩니다.',
  },
  {
    question: '예배는 얼마나 걸리나요?',
    answer: '주일예배는 찬양, 기도, 설교를 포함해 약 70분 정도 진행됩니다.',
  },
]

const nextGen = [
  { title: '유치부', photo: '/images/nextgen/kinder.webp', info: '본당 1층 유치부실 · 주일 오전 9:00' },
  { title: '아동부', photo: '/images/nextgen/children.webp', info: '교육관 1층 · 주일 오전 9:00' },
  { title: '중·고등부', photo: '/images/nextgen/youth.webp', info: '교육관 지하 · 주일 오전 9:00' },
]

export default function NewFamilyPage() {
  return (
    <>
      <Hero />
      <Welcome />
      <ServiceFlow />
      <Faq />
      <NextGeneration />
      <Visit />
      <Cta />
    </>
  )
}

function Hero() {
  return (
    <section className="flex min-h-[480px] items-center bg-accent-deep py-28 text-center text-white min-[960px]:min-h-[60svh]">
      <Container size="wide" className="pt-14">
        <Reveal>
          <p className="text-sm font-extrabold uppercase tracking-[0.3em] text-gold">First Visit</p>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="mx-auto mt-6 max-w-4xl text-[clamp(38px,6vw,62px)] font-extrabold leading-[1.2] tracking-tight">
            교회가 처음이세요?
            <br />
            진심으로 환영합니다.
          </h1>
        </Reveal>
        <Reveal delay={240}>
          <p className="mx-auto mt-6 max-w-[640px] text-[clamp(17px,2vw,20px)] leading-[1.75] text-white/85">
            낯설고 조심스러운 마음 그대로 오셔도 괜찮습니다.
            <br className="hidden sm:block" />
            영천중앙교회가 처음 방문의 길을 차분히 안내해드립니다.
          </p>
        </Reveal>
      </Container>
    </section>
  )
}

function Welcome() {
  return (
    <section className="bg-paper py-24 min-[960px]:py-28">
      <Container>
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto h-1 w-14 bg-gold" aria-hidden />
            <blockquote className="mt-8 text-[clamp(24px,3.2vw,32px)] font-extrabold leading-[1.6] tracking-tight text-accent-deep">
              신앙의 문턱이 높게 느껴지신다면
              <br />
              그 마음 그대로 오셔도 괜찮습니다.
              <br />
              한 분 한 분을 귀한 가족으로 맞이하겠습니다.
            </blockquote>
            <p className="mt-7 text-sm font-bold text-faint">영천중앙교회 담임목사 드림</p>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}

function ServiceFlow() {
  const flowWorshipItems = adultWorshipSchedule.slice(0, 4)

  return (
    <section id="flow" className="scroll-mt-28 bg-paper py-20 min-[960px]:py-28">
      <Container>
        <Reveal>
          <SectionTitle
            eyebrow="Order of Service"
            title="주일예배는 이렇게 진행됩니다"
            description="전체 예배는 약 70분입니다. 처음 오신 분도 흐름을 따라가기 어렵지 않도록 안내합니다."
            align="center"
          />
        </Reveal>
        <Reveal delay={90}>
          <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
            {flowWorshipItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4">
                <span className="text-lg font-extrabold text-ink">{item.name}</span>
                <span className="text-sm font-semibold text-ink-muted">{item.displayTime}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-sm text-ink-muted">
            다음세대 예배와 장소 안내는{' '}
            <Link href="/worship" className="font-bold text-accent-deep underline-offset-4 hover:underline">
              전체 예배 시간표
            </Link>
            에서 확인하실 수 있습니다.
          </p>
        </Reveal>
        <div className="mx-auto mt-14 grid max-w-3xl gap-0">
          {timeline.map((item, index) => (
            <Reveal key={item.title} delay={index * 90}>
              <div className="relative grid grid-cols-[56px_1fr] gap-5 pb-9 last:pb-0 sm:grid-cols-[64px_1fr] sm:gap-6">
                {index !== timeline.length - 1 && <span className="absolute bottom-0 left-7 top-14 w-px bg-line sm:left-8 sm:top-16" aria-hidden />}
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-paper bg-surface text-xl font-extrabold text-accent shadow-subtle sm:h-16 sm:w-16 sm:text-2xl">
                  {index + 1}
                </span>
                <div className="pt-1.5">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">{item.time}</p>
                  <h3 className="mt-2 text-2xl font-extrabold text-ink">{item.title}</h3>
                  <p className="mt-2 leading-7 text-ink-muted">{item.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 bg-surface py-20 min-[960px]:py-28">
      <Container>
        <Reveal>
          <SectionTitle eyebrow="FAQ" title="처음 오시는 분들이 자주 묻는 질문" align="center" />
        </Reveal>
        <div className="mx-auto mt-11 grid max-w-3xl gap-3.5">
          {faqs.map((faq, index) => (
            <Reveal key={faq.question} delay={index * 55}>
              <details open={index === 0} className="group overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-lg font-bold text-ink marker:hidden sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xl leading-none text-accent transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="px-5 pb-6 leading-7 text-ink-muted sm:px-6">{faq.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}

function NextGeneration() {
  return (
    <section id="nextgen" className="scroll-mt-28 bg-bg py-20 min-[960px]:py-28">
      <Container size="wide">
        <Reveal>
          <SectionTitle
            eyebrow="For Families"
            title="주일학교 안내입니다"
            align="center"
          />
        </Reveal>
        <div className="mt-12 grid gap-6 min-[960px]:grid-cols-3">
          {nextGen.map((group, index) => (
            <Reveal key={group.title} delay={index * 110}>
              <article className="motion-hover h-full overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle transition hover:-translate-y-1 hover:shadow-lifted">
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={group.photo}
                    alt={`${group.title} 활동 사진`}
                    fill
                    unoptimized
                    sizes="(min-width: 960px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-extrabold text-accent-deep">{group.title}</h3>
                  <p className="mt-3 text-[15px] font-bold text-gold-deep">{group.info}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}

function Visit() {
  return (
    <VisitBlock
      eyebrow="Visit us"
      title="오시는 길"
      description="처음 오시는 길이 어렵지 않도록 지도와 연락처를 함께 안내합니다."
      showPastorKakao
      media={
        <div className="overflow-hidden rounded-[20px] border border-line">
          <KakaoMap />
        </div>
      }
    />
  )
}

function Cta() {
  return (
    <section className="relative isolate overflow-hidden bg-accent-deep py-24 text-center text-white min-[960px]:py-[150px]">
      <Image src="/images/church-cta.webp" alt="" fill unoptimized sizes="100vw" className="-z-20 object-cover" />
      <div className="absolute inset-0 -z-10 bg-accent-deep/[0.82]" />
      <Container>
        <Reveal>
          <h2 className="text-[clamp(32px,5vw,58px)] font-extrabold leading-[1.15] tracking-tight">
            이번 주일,
            <br />
            함께 예배드려요.
          </h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-lg leading-8 text-white/90">
            길이 막막하거나 궁금한 점이 있다면 미리 연락 주세요. 방문 전부터 편안히 안내해드리겠습니다.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <HomeButton href={`tel:${churchInfo.phone}`} variant="white">
              전화 문의
            </HomeButton>
            <HomeButton href="/worship" variant="ghost">
              전체 예배 시간표
            </HomeButton>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
