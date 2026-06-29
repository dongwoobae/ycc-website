'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { GalleryImage } from '@/lib/types'

interface Props {
  images: GalleryImage[]
  albumTitle: string
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function IconChevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}

export default function GalleryGrid({ images, albumTitle }: Props) {
  const [index, setIndex] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  const isOpen = index !== null
  const current = isOpen ? images[index] : null

  const prev = useCallback(() => {
    setIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : null))
  }, [images.length])

  const next = useCallback(() => {
    setIndex((i) => (i !== null ? (i + 1) % images.length : null))
  }, [images.length])

  const close = useCallback(() => setIndex(null), [])

  // 키보드 네비(←/→/Esc) + 포커스 트랩
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Tab') {
        const f = dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
        if (!f || f.length === 0) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close, prev, next])

  // 라이트박스 열림 시 포커스 이동, 닫힘 시 복원
  useEffect(() => {
    if (!isOpen) return
    lastFocusedRef.current = document.activeElement as HTMLElement
    dialogRef.current?.focus()
    return () => lastFocusedRef.current?.focus?.()
  }, [isOpen])

  // 배경 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const orbBtn =
    'flex cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-white transition-colors hover:bg-white/20'

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {images.map((image, i) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setIndex(i)}
            className="group block overflow-hidden rounded-lg border border-line bg-paper text-left shadow-subtle transition hover:shadow-soft"
          >
            <div className="relative aspect-[4/3] bg-surface">
              <Image
                src={image.imageUrl}
                alt={image.alt}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            {image.caption && <p className="p-4 text-sm text-ink-muted">{image.caption}</p>}
          </button>
        ))}
      </div>

      {isOpen && current && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${albumTitle} 사진 확대 보기`}
          tabIndex={-1}
          className="fixed inset-0 z-[100] flex flex-col bg-[rgba(8,14,26,0.92)] backdrop-blur-md"
          onClick={close}
        >
          {/* 상단 바 */}
          <div className="flex items-center justify-between px-6 py-[18px]">
            <div className="flex items-center gap-[18px]">
              <b className="text-base font-semibold text-white">{albumTitle}</b>
              <span className="font-mono text-[13px] text-white/60">
                {(index ?? 0) + 1} / {images.length}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                close()
              }}
              aria-label="닫기"
              className={`${orbBtn} h-10 w-10`}
            >
              <IconClose />
            </button>
          </div>

          {/* 스테이지 */}
          <div className="relative flex flex-1 items-center justify-center px-2 md:px-20">
            {images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  prev()
                }}
                aria-label="이전"
                className={`${orbBtn} absolute left-4 h-14 w-14`}
              >
                <IconChevron dir="left" />
              </button>
            )}

            <div
              className="relative flex max-h-full max-w-full items-center justify-center"
              style={{ width: 'min(900px, 85vw)', height: 'calc(100vh - 200px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                key={current.imageUrl}
                src={current.imageUrl}
                alt={current.caption ?? current.alt}
                fill
                className="rounded-lg object-contain"
                sizes="(min-width: 900px) 900px, 85vw"
                priority
              />
            </div>

            {images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  next()
                }}
                aria-label="다음"
                className={`${orbBtn} absolute right-4 h-14 w-14`}
              >
                <IconChevron dir="right" />
              </button>
            )}
          </div>

          {/* 하단: 캡션 + 썸네일 스트립 */}
          <div className="px-6 pb-6 pt-[18px]">
            {current.caption && <div className="mb-3.5 text-center text-sm text-white/80">{current.caption}</div>}
            <div className="flex justify-center gap-1.5 overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}번째 사진`}
                  className={`h-11 w-[60px] flex-shrink-0 cursor-pointer overflow-hidden rounded border-2 transition-all ${
                    i === index
                      ? 'border-white opacity-100'
                      : 'border-transparent opacity-50 hover:-translate-y-0.5 hover:opacity-85'
                  }`}
                >
                  <Image
                    src={image.imageUrl}
                    alt=""
                    width={120}
                    height={88}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
