import Link from 'next/link'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow } from './HomePrimitives'

// 말씀 하위 = /sermons?worship= 딥링크(기존 필터 재사용). 주일학교·찬양 부서/찬양대 페이지는 Phase 3에서 생성 예정 → 지금은 라벨만.
const worshipLinks = ['주일예배', '주일찬양예배', '수요예배']
const schoolItems = ['유치부', '아동부', '중고등부']
const praiseItems = ['시온찬양대', '할렐루야찬양대', '호산나찬양대']

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/25 bg-white/5 px-4 py-2 text-[13.5px] font-bold text-white/90">
      {children}
    </span>
  )
}

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
          {/* 말씀 */}
          <Reveal delay={80} className="h-full">
            <article className="flex h-full flex-col rounded-3xl bg-[linear-gradient(150deg,oklch(0.46_0.13_258),oklch(0.27_0.09_260))] p-7 text-white shadow-soft">
              <h3 className="text-2xl font-extrabold tracking-tight">말씀</h3>
              {sermonSummary ? (
                <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-white/85">“{sermonSummary}”</p>
              ) : (
                <p className="mt-3 text-[15px] leading-7 text-white/80">매 예배의 말씀을 다시 듣고 묵상합니다.</p>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                {worshipLinks.map((label) => (
                  <Link
                    key={label}
                    href={`/sermons?worship=${encodeURIComponent(label)}`}
                    className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[13.5px] font-bold transition hover:bg-white/20"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </article>
          </Reveal>

          {/* 주일학교 */}
          <Reveal delay={160} className="h-full">
            <article className="flex h-full flex-col rounded-3xl bg-[linear-gradient(150deg,oklch(0.5_0.12_236),oklch(0.3_0.09_248))] p-7 text-white shadow-soft">
              <h3 className="text-2xl font-extrabold tracking-tight">주일학교</h3>
              <p className="mt-3 text-[15px] leading-7 text-white/80">다음 세대가 말씀 위에 자랍니다.</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                {schoolItems.map((label) => (
                  <Pill key={label}>{label}</Pill>
                ))}
              </div>
            </article>
          </Reveal>

          {/* 찬양 */}
          <Reveal delay={240} className="h-full">
            <article className="flex h-full flex-col rounded-3xl bg-[linear-gradient(150deg,oklch(0.52_0.11_286),oklch(0.32_0.09_278))] p-7 text-white shadow-soft">
              <h3 className="text-2xl font-extrabold tracking-tight">찬양</h3>
              <p className="mt-3 text-[15px] leading-7 text-white/80">찬양으로 하나님께 영광을 올려 드립니다.</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                {praiseItems.map((label) => (
                  <Pill key={label}>{label}</Pill>
                ))}
              </div>
            </article>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
