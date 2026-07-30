'use client'

import Image from 'next/image'
import { useState } from 'react'
import { formatPageAlt } from '@/lib/bulletin-format'
import BulletinLightbox from './BulletinLightbox'
import type { BulletinPage } from '@/lib/types'

interface BulletinPageViewerProps {
  pages: BulletinPage[]
  bulletinDate: string
  pdfUrl?: string
}

/**
 * 인라인 원본 뷰어.
 *
 * 줌을 두지 않는다 — 확대는 라이트박스의 책임이고, 같은 기능을 두 곳에 두지 않는다.
 * 썸네일 클릭은 큰 이미지만 바꾼다. 즉시 전체화면이 뜨면 면을 훑어보는 것이 불가능해지고,
 * 잘못 눌렀을 때 빠져나오는 비용이 클릭보다 커진다.
 */
export default function BulletinPageViewer({ pages, bulletinDate, pdfUrl }: BulletinPageViewerProps) {
  const [current, setCurrent] = useState(0)
  const [lightboxFrom, setLightboxFrom] = useState<number | null>(null)

  if (pages.length === 0) return null
  const page = pages[Math.min(current, pages.length - 1)]

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">원본 주보</h2>

      {pages.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" data-testid="bulletin-thumb-strip">
          {pages.map((item, index) => (
            <button
              key={item.thumbUrl}
              type="button"
              onClick={() => setCurrent(index)}
              aria-label={`${index + 1}면 보기`}
              aria-current={index === current}
              className={
                index === current
                  ? 'shrink-0 overflow-hidden rounded border-2 border-gold'
                  : 'shrink-0 overflow-hidden rounded border border-line transition hover:border-line-strong'
              }
            >
              <Image
                src={item.thumbUrl}
                alt={formatPageAlt(bulletinDate, index + 1)}
                width={56}
                height={Math.round((56 * item.height) / item.width)}
                unoptimized
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setLightboxFrom(current)}
        aria-label={`${current + 1}면 크게 보기`}
        className="mt-3 block w-full overflow-hidden rounded-lg border border-line bg-paper"
        data-testid="bulletin-current-page"
      >
        <Image
          src={page.previewUrl}
          alt={formatPageAlt(bulletinDate, current + 1)}
          width={page.width}
          height={page.height}
          unoptimized
          className="h-auto w-full"
        />
      </button>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setLightboxFrom(current)}
          className="flex-1 rounded-lg bg-[#0B1F5C] px-4 py-2.5 text-xs font-extrabold text-gold-soft transition hover:opacity-90"
        >
          원본 크게 보기
        </button>
        {pdfUrl ? (
          <a
            href={pdfUrl}
            className="flex-1 rounded-lg border border-[#0B1F5C] px-4 py-2.5 text-center text-xs font-extrabold text-[#0B1F5C] transition hover:bg-line-soft"
          >
            PDF 저장
          </a>
        ) : null}
      </div>

      {lightboxFrom !== null ? (
        <BulletinLightbox
          pages={pages}
          bulletinDate={bulletinDate}
          startPageIndex={lightboxFrom}
          pdfUrl={pdfUrl}
          onClose={() => setLightboxFrom(null)}
        />
      ) : null}
    </section>
  )
}
