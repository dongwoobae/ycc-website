import Image from 'next/image'
import type { ReactNode } from 'react'

interface AdminPageHeroProps {
  title: string
  image: string
  eyebrow?: string
  subtitle?: string
  action?: ReactNode
}

/**
 * admin 상단 슬림 hero(144px). 공개 PageHero(288~352px 몰입형)와 달리
 * 작업영역을 거의 잠식하지 않는 장식 띠. 콘텐츠 영역 안에 카드처럼 깔린다.
 */
export default function AdminPageHero({ title, image, eyebrow, subtitle, action }: AdminPageHeroProps) {
  return (
    <section className="relative mb-6 h-36 overflow-hidden rounded-xl">
      <Image src={image} alt="" fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/60 to-ink/45" />
      <div className="relative flex h-full items-center justify-between gap-4 px-6">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#a8c6ef]">{eyebrow}</p>
          )}
          <h1 className="truncate font-serif text-2xl font-extrabold text-bg sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 line-clamp-1 text-sm text-bg/80">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </section>
  )
}
