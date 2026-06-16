import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow, ImagePlaceholder } from './HomePrimitives'

const cells = [
  { label: '함께 드리는 예배', className: 'min-[960px]:col-span-2', placeholder: '예배 장면 사진' },
  { label: '우리 공동체', className: 'min-[960px]:row-span-2', placeholder: '공동체 모임 사진' },
  { label: '다음세대', className: '', placeholder: '다음세대 예배 사진' },
  { label: '찬양', className: '', placeholder: '찬양팀 사진' },
  { label: '영천중앙교회', className: 'min-[960px]:col-span-2', placeholder: '교회 전경 사진' },
]

export default function Gallery() {
  return (
    <section id="tour" className="bg-bg py-24 min-[960px]:py-32">
      <Container size="wide">
        <Reveal>
          <Eyebrow>Our church</Eyebrow>
          <h2 className="mt-4 text-[clamp(30px,4.4vw,52px)] font-extrabold leading-tight tracking-tight text-ink">
            사진으로 만나는 <span className="text-accent">우리</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid auto-rows-[220px] grid-cols-1 gap-4 min-[960px]:grid-cols-3 min-[960px]:auto-rows-[240px]">
          {cells.map((cell, index) => (
            <Reveal key={cell.label} delay={index * 70} className={cell.className}>
              <div className="relative h-full overflow-hidden rounded-2xl border border-line">
                <ImagePlaceholder label={cell.placeholder} />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent from-50% to-black/55" />
                <p className="absolute bottom-4 left-5 text-sm font-bold tracking-wide text-white [text-shadow:0_2px_12px_rgb(0_0_0/.6)]">
                  {cell.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
