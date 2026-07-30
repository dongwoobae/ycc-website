'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatPageAlt } from '@/lib/bulletin-format'
import {
  lastSpreadStart,
  moveSpread,
  pagesPerSpread,
  realignSpread,
  spreadLabel,
  spreadPageIndexes,
  spreadStartForPage,
} from '@/lib/bulletin-spread'
import { isDraggable, nextZoom, offsetForStep, zoomScale, type Offset, type ZoomStep } from '@/lib/bulletin-zoom'
import type { BulletinPage } from '@/lib/types'

/** 스와이프로 인정할 최소 가로 이동 거리(px). 이보다 짧으면 탭으로 본다. */
const swipeThreshold = 50

interface BulletinLightboxProps {
  pages: BulletinPage[]
  bulletinDate: string
  startPageIndex: number
  pdfUrl?: string
  onClose: () => void
}

/**
 * 전체화면 스프레드 뷰어.
 *
 * Fullscreen API 에 의존하지 않는다 — iOS Safari 는 <video> 외의 요소에
 * requestFullscreen() 을 지원하지 않는다. position:fixed 오버레이로 구현하고
 * Fullscreen 은 지원되는 환경에서만 부가로 건다.
 */
export default function BulletinLightbox({
  pages,
  bulletinDate,
  startPageIndex,
  pdfUrl,
  onClose,
}: BulletinLightboxProps) {
  const initialPerSpread = typeof window === 'undefined' ? 1 : pagesPerSpread(window.innerWidth)
  const [perSpread, setPerSpread] = useState(initialPerSpread)
  // 진입 면을 스프레드 경계로 정렬해 둔다. 정렬하지 않으면 이후 moveSpread 가
  // 어긋난 기준에서 계산돼 다음 면으로 가야 할 때 뒤로 돌아가는 일이 생긴다.
  const [start, setStart] = useState(() => spreadStartForPage(startPageIndex, pages.length, initialPerSpread))
  const [zoom, setZoom] = useState<ZoomStep>('fit')
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [showStrip, setShowStrip] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{ pointerId: number; originX: number; originY: number; from: Offset } | null>(null)

  const indexes = useMemo(() => spreadPageIndexes(start, pages.length, perSpread), [start, pages.length, perSpread])

  // 스프레드 콘텐츠의 자연 크기 — 나란히 붙인 폭 합계와 최대 높이
  const content = useMemo(() => {
    const shown = indexes.map((index) => pages[index]).filter(Boolean)
    return {
      width: shown.reduce((sum, page) => sum + page.width, 0),
      height: shown.reduce((max, page) => Math.max(max, page.height), 0),
    }
  }, [indexes, pages])

  const move = useCallback(
    (delta: -1 | 1) => {
      setStart((current) => moveSpread(current, delta, pages.length, perSpread))
      setZoom('fit')
      setOffset({ x: 0, y: 0 })
    },
    [pages.length, perSpread]
  )

  // 폭이 바뀌면 현재 스프레드의 첫 면을 유지한 채 재정렬한다
  useEffect(() => {
    function onResize() {
      const next = pagesPerSpread(window.innerWidth)
      setPerSpread((current) => {
        if (current === next) return current
        setStart((currentStart) => realignSpread(currentStart, pages.length, next))
        return next
      })
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pages.length])

  // 다음 스프레드 한 세트만 미리 받는다. 2000px WebP 는 장당 300~600KB 라
  // 전부 프리로드하면 6면짜리에서 3MB 가까이 낭비된다.
  useEffect(() => {
    const nextStart = moveSpread(start, 1, pages.length, perSpread)
    if (nextStart === start) return
    const preloaded = spreadPageIndexes(nextStart, pages.length, perSpread).map((index) => {
      const image = new window.Image()
      image.src = pages[index].fullUrl
      return image
    })
    return () => {
      for (const image of preloaded) image.src = ''
    }
  }, [start, perSpread, pages])

  // 열릴 때 포커스를 닫기 버튼으로 옮기고 배경 스크롤을 잠근다
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  // Escape 로 닫고, 방향키로 스프레드를 넘기며, Tab 포커스를 오버레이 안에 가둔다
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        move(1)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        move(-1)
        return
      }
      if (event.key !== 'Tab') return

      const focusables = stageRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [move, onClose])

  function applyZoom(step: ZoomStep) {
    const viewport = stageRef.current?.getBoundingClientRect()
    const size = { width: viewport?.width ?? 0, height: viewport?.height ?? 0 }
    setZoom(step)
    setOffset(offsetForStep(step, offset, size, content))
  }

  // 확대 상태에서는 드래그가 화면 이동이고, 맞춤 상태에서는 같은 제스처가 스프레드 넘김이다.
  // 스펙: "줌이 맞춤이 아닐 때는 스프레드 단위 이동 대신 드래그가 우선한다"
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, from: offset }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!isDraggable(zoom)) return
    const viewport = stageRef.current?.getBoundingClientRect()
    const size = { width: viewport?.width ?? 0, height: viewport?.height ?? 0 }
    const moved = {
      x: drag.from.x + (event.clientX - drag.originX),
      y: drag.from.y + (event.clientY - drag.originY),
    }
    setOffset(offsetForStep(zoom, moved, size, content))
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (isDraggable(zoom)) return

    const dx = event.clientX - drag.originX
    const dy = event.clientY - drag.originY
    // 세로로 더 많이 움직였으면 스크롤 의도로 보고 무시한다
    if (Math.abs(dx) < swipeThreshold || Math.abs(dx) <= Math.abs(dy)) return
    move(dx < 0 ? 1 : -1)
  }

  const viewportRect = stageRef.current?.getBoundingClientRect()
  const scale = zoomScale(zoom, { width: viewportRect?.width ?? 0, height: viewportRect?.height ?? 0 }, content)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulletin-lightbox-title"
      className="fixed inset-0 z-50 flex flex-col bg-[#14171d]"
    >
      <h2 id="bulletin-lightbox-title" className="sr-only">
        원본 주보 크게 보기
      </h2>

      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <ToolButton onClick={() => setShowStrip((v) => !v)} pressed={showStrip} label="면 목록">
            면 목록
          </ToolButton>
          <ToolButton onClick={() => applyZoom('fit')} pressed={zoom === 'fit'} label="화면에 맞춤">
            맞춤
          </ToolButton>
          <ToolButton onClick={() => applyZoom('1x')} pressed={zoom === '1x'} label="원래 크기">
            1×
          </ToolButton>
          <ToolButton onClick={() => applyZoom('2x')} pressed={zoom === '2x'} label="2배 확대">
            2×
          </ToolButton>
          <ToolButton onClick={() => applyZoom(nextZoom(zoom, 1))} label="한 단계 확대">
            ＋
          </ToolButton>
        </div>
        <p className="text-xs font-bold text-white/60">{spreadLabel(start, pages.length, perSpread)}</p>
        <div className="flex items-center gap-1.5">
          {pdfUrl ? (
            <a
              href={pdfUrl}
              className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/20"
            >
              PDF 저장
            </a>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/20"
          >
            닫기
          </button>
        </div>
      </div>

      {showStrip ? (
        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2">
          {pages.map((page, index) => (
            <button
              key={page.thumbUrl}
              type="button"
              onClick={() => {
                setStart(realignSpread(index, pages.length, perSpread))
                setZoom('fit')
                setOffset({ x: 0, y: 0 })
              }}
              className={
                indexes.includes(index)
                  ? 'shrink-0 rounded border-2 border-gold'
                  : 'shrink-0 rounded border border-white/20'
              }
            >
              <Image
                src={page.thumbUrl}
                alt={formatPageAlt(bulletinDate, index + 1)}
                width={48}
                height={Math.round((48 * page.height) / page.width)}
                unoptimized
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-1 items-center gap-2 overflow-hidden px-2 py-3">
        <NavButton onClick={() => move(-1)} label="이전 면" disabled={start === 0}>
          ‹
        </NavButton>
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          style={{ cursor: isDraggable(zoom) ? 'grab' : 'default', touchAction: 'none' }}
        >
          <div
            className="flex items-start gap-2"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
          >
            {indexes.map((index) => (
              <SpreadPage
                key={pages[index].fullUrl}
                page={pages[index]}
                alt={formatPageAlt(bulletinDate, index + 1)}
              />
            ))}
          </div>
        </div>
        <NavButton
          onClick={() => move(1)}
          label="다음 면"
          disabled={start >= lastSpreadStart(pages.length, perSpread)}
        >
          ›
        </NavButton>
      </div>
    </div>
  )
}

/**
 * 인라인에서 이미 받아둔 preview 를 먼저 깔고, full 로드가 끝나면 그 위로 덮는다.
 * 라이트박스를 열자마자 흰 화면을 보지 않게 하는 것이 목적이다.
 */
function SpreadPage({ page, alt }: { page: BulletinPage; alt: string }) {
  const [fullLoaded, setFullLoaded] = useState(false)

  return (
    <div className="relative bg-white" style={{ width: page.width, height: page.height }}>
      <Image
        src={page.previewUrl}
        alt=""
        aria-hidden
        fill
        unoptimized
        sizes="100vw"
        className="object-contain"
      />
      <Image
        src={page.fullUrl}
        alt={alt}
        fill
        unoptimized
        priority
        sizes="100vw"
        onLoad={() => setFullLoaded(true)}
        className={fullLoaded ? 'object-contain opacity-100' : 'object-contain opacity-0'}
      />
    </div>
  )
}

function ToolButton({
  onClick,
  pressed,
  label,
  children,
}: {
  onClick: () => void
  pressed?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={
        pressed
          ? 'rounded-md bg-[#0B1F5C] px-2.5 py-1.5 text-xs font-bold text-gold-soft'
          : 'rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/20'
      }
    >
      {children}
    </button>
  )
}

function NavButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void
  label: string
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="h-14 w-8 shrink-0 rounded-lg bg-white/10 text-lg text-white/70 transition hover:bg-white/20 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
