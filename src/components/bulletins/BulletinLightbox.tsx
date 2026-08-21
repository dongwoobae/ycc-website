'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatPageAlt } from '@/lib/bulletin-format'
import { clampPageIndex, isLastPage, movePage, pageLabel } from '@/lib/bulletin-paging'
import {
  distance,
  fitView,
  isDraggable,
  midpoint,
  panTo,
  scaleFor,
  wheelZoomFactor,
  zoomAt,
  type Offset,
  type ZoomState,
} from '@/lib/bulletin-zoom'
import type { BulletinPage } from '@/lib/types'

/** 확대 버튼·키보드 ＋/－ 한 번의 배율 변화. 제스처를 모르는 사용자의 줌 경로다. */
const stepZoomFactor = 1.4

interface BulletinLightboxProps {
  pages: BulletinPage[]
  bulletinDate: string
  startPageIndex: number
  pdfUrl?: string
  onClose: () => void
}

/** 클라이언트 좌표를 스테이지 중심 기준으로 옮긴다 — transform-origin 이 center 이므로 원점을 맞춘다. */
function anchorFor(stage: HTMLElement, clientX: number, clientY: number): Offset {
  const box = stage.getBoundingClientRect()
  return { x: clientX - (box.left + box.width / 2), y: clientY - (box.top + box.height / 2) }
}

/**
 * 전체화면 뷰어. 화면 폭과 무관하게 한 면씩 띄운다.
 *
 * Fullscreen API 에 의존하지 않는다 — iOS Safari 는 <video> 외의 요소에
 * requestFullscreen() 을 지원하지 않는다. position:fixed 오버레이로 구현하고
 * Fullscreen 은 지원되는 환경에서만 부가로 건다.
 *
 * 확대는 제스처가 전부다: 터치·트랙패드는 두 손가락 벌리기, 데스크탑은 휠 스크롤.
 * 면 이동은 이동 버튼·면 목록·좌우 방향키뿐이다 — 드래그는 언제나 화면 이동이며
 * 제스처로 면이 넘어가지 않는다. 확대해서 읽는 중에 면이 바뀌면 위치를 잃는다.
 */
export default function BulletinLightbox({
  pages,
  bulletinDate,
  startPageIndex,
  pdfUrl,
  onClose,
}: BulletinLightboxProps) {
  const [current, setCurrent] = useState(() => clampPageIndex(startPageIndex, pages.length))
  // 배율과 오프셋은 항상 함께 바뀐다(확대하면 앵커를 맞추느라 오프셋도 움직인다).
  // 따로 두면 한쪽만 반영된 중간 상태가 한 프레임 보인다.
  const [view, setView] = useState<ZoomState>(fitView)
  const [showStrip, setShowStrip] = useState(false)
  // 스테이지 크기를 상태로 들고 있는다. 렌더 중에 ref 로 측정하면 첫 렌더에서 0이 나와
  // 「맞춤」 배율이 0이 되고, 다시 그릴 계기가 없어 면이 화면에 나타나지 않는다.
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const stageRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // 눌려 있는 포인터 전부. 2개가 되면 핀치, 1개면 드래그다.
  const pointersRef = useRef(new Map<number, Offset>())
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null)
  const dragRef = useRef<{ pointerId: number; originX: number; originY: number; from: Offset } | null>(null)

  const page = pages[clampPageIndex(current, pages.length)]

  // 면의 자연 크기
  const content = useMemo(() => ({ width: page?.width ?? 0, height: page?.height ?? 0 }), [page?.width, page?.height])

  const move = useCallback(
    (delta: -1 | 1) => {
      setCurrent((index) => movePage(index, delta, pages.length))
      setView(fitView)
    },
    [pages.length],
  )

  // 버튼·키보드 줌. 포인터 위치가 없으므로 화면 중앙을 앵커로 쓴다.
  const zoomByStep = useCallback(
    (direction: -1 | 1) => {
      const factor = direction === 1 ? stepZoomFactor : 1 / stepZoomFactor
      setView((currentView) => zoomAt(currentView, currentView.zoom * factor, { x: 0, y: 0 }, stageSize, content))
    },
    [stageSize, content],
  )

  // 스테이지 실측. 툴바·썸네일 스트립 토글로도 높이가 바뀌므로 창 resize 만으로는 부족하다.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      setStageSize({ width: box.width, height: box.height })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // 다음 면 하나만 미리 받는다. 2000px WebP 는 장당 300~600KB 라
  // 전부 프리로드하면 6면짜리에서 3MB 가까이 낭비된다.
  useEffect(() => {
    const next = movePage(current, 1, pages.length)
    if (next === current) return
    const image = new window.Image()
    image.src = pages[next].fullUrl
    return () => {
      image.src = ''
    }
  }, [current, pages])

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

  // 휠·트랙패드 줌. React 의 onWheel 은 루트에 passive 로 붙어 preventDefault 가 먹지 않는다.
  // 막지 않으면 Ctrl+휠(맥 트랙패드 핀치가 보내는 이벤트)이 브라우저 페이지 줌으로 새어 나간다.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    // 함수 선언문이 아니라 화살표 함수로 둔다 — 선언문은 호이스팅돼 위의 null 체크가 좁혀지지 않는다
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const anchor = anchorFor(stage, event.clientX, event.clientY)
      setView((currentView) =>
        zoomAt(
          currentView,
          currentView.zoom * wheelZoomFactor(event.deltaY, event.deltaMode),
          anchor,
          stageSize,
          content,
        ),
      )
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [stageSize, content])

  // Escape 로 닫고, 방향키로 면을 넘기며, ＋/－/0 으로 줌한다(포인터 장치 없이 쓰는 경로).
  // Tab 포커스는 오버레이 안에 가둔다.
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
      if (event.key === '0') {
        event.preventDefault()
        setView(fitView)
        return
      }
      if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '_') {
        event.preventDefault()
        zoomByStep(event.key === '-' || event.key === '_' ? -1 : 1)
        return
      }
      if (event.key !== 'Tab') return

      const focusables = stageRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
  }, [move, onClose, zoomByStep])

  // 손가락이 둘이면 핀치, 하나면 드래그(화면 이동)다.
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)

    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()]
      pinchRef.current = { startDistance: distance(a, b), startZoom: view.zoom }
      dragRef.current = null
      return
    }
    dragRef.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, from: view.offset }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const pinch = pinchRef.current
    if (pinch && pointers.size >= 2) {
      if (!(pinch.startDistance > 0)) return
      const [a, b] = [...pointers.values()]
      // 시작 시점 기준의 절대 배율로 계산한다. 프레임마다 곱하면 오차가 쌓여 손가락과 어긋난다.
      const target = pinch.startZoom * (distance(a, b) / pinch.startDistance)
      const center = midpoint(a, b)
      const anchor = anchorFor(event.currentTarget, center.x, center.y)
      setView((currentView) => zoomAt(currentView, target, anchor, stageSize, content))
      return
    }

    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!isDraggable(view.zoom)) return
    const moved = {
      x: drag.from.x + (event.clientX - drag.originX),
      y: drag.from.y + (event.clientY - drag.originY),
    }
    setView((currentView) => panTo(currentView, moved, stageSize, content))
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current
    pointers.delete(event.pointerId)
    if (pointers.size < 2) pinchRef.current = null
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  // 실측 전(0×0)에는 「맞춤」이 0을 주므로 면을 그리지 않는다 — ResizeObserver 가
  // 첫 페인트 직후 크기를 채우면 정상 배율로 나타난다.
  const scale = scaleFor(view.zoom, stageSize, content)

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
        <ToolButton onClick={() => setShowStrip((v) => !v)} pressed={showStrip} label="면 목록">
          면 목록
        </ToolButton>
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
          {pages.map((item, index) => (
            <button
              key={item.thumbUrl}
              type="button"
              onClick={() => {
                setCurrent(index)
                setView(fitView)
              }}
              className={
                index === current ? 'shrink-0 rounded border-2 border-gold' : 'shrink-0 rounded border border-white/20'
              }
            >
              <Image
                src={item.thumbUrl}
                alt={formatPageAlt(bulletinDate, index + 1)}
                width={48}
                height={Math.round((48 * item.height) / item.width)}
                unoptimized
              />
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        style={{ cursor: isDraggable(view.zoom) ? 'grab' : 'default', touchAction: 'none' }}
      >
        {page ? (
          <div
            data-testid="bulletin-lightbox-page"
            style={{
              transform: `translate(${view.offset.x}px, ${view.offset.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
          >
            <LightboxPage page={page} alt={formatPageAlt(bulletinDate, current + 1)} />
          </div>
        ) : null}
      </div>

      {/* 조작은 전부 하단 바에 모은다. 면 위에 띄우면 읽는 면적은 벌지만 무엇이 눌리는 것인지
          알아보기 어렵다. 확대·이동을 처음 쓰는 사람 기준으로는 항상 보이고 글자가 붙어 있는
          쪽이 낫고, 아래쪽이 손가락이 닿는 자리다. */}
      <div className="border-t border-white/10 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-center justify-center gap-2">
          <ZoomButton onClick={() => zoomByStep(-1)} label="작게 보기">
            － 작게
          </ZoomButton>
          <ZoomButton onClick={() => setView(fitView)} label="화면에 맞추기">
            원래대로
          </ZoomButton>
          <ZoomButton onClick={() => zoomByStep(1)} label="크게 보기">
            ＋ 크게
          </ZoomButton>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <NavButton onClick={() => move(-1)} label="이전 면 보기" hidden={current === 0}>
            ◀ 이전 면
          </NavButton>
          <p className="w-24 shrink-0 text-center text-sm font-bold text-white/80">
            {pageLabel(current, pages.length)}
          </p>
          <NavButton onClick={() => move(1)} label="다음 면 보기" hidden={isLastPage(current, pages.length)}>
            다음 면 ▶
          </NavButton>
        </div>
      </div>
    </div>
  )
}

/**
 * 인라인에서 이미 받아둔 preview 를 먼저 깔고, full 로드가 끝나면 그 위로 덮는다.
 * 라이트박스를 열자마자 흰 화면을 보지 않게 하는 것이 목적이다.
 */
function LightboxPage({ page, alt }: { page: BulletinPage; alt: string }) {
  const [fullLoaded, setFullLoaded] = useState(false)

  return (
    <div className="relative bg-white" style={{ width: page.width, height: page.height }}>
      <Image src={page.previewUrl} alt="" aria-hidden fill unoptimized sizes="100vw" className="object-contain" />
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

/**
 * 하단 이동 버튼. 어두운 툴바 위에서 가장 잘 읽히는 조합인 흰 바탕 + 딥네이비 글자를 쓴다.
 * 딥네이비 바탕은 툴바(#14171d)와 둘 다 어두워 경계가 흐려진다.
 *
 * 화살표만 두지 않고 「이전 면」·「다음 면」을 함께 적는다 — 기호만으로는 무엇이 넘어가는지
 * 알 수 없고, 이 뷰어에서 면을 넘기는 방법은 이 버튼과 면 목록뿐이다.
 */
function NavButton({
  onClick,
  label,
  hidden,
  children,
}: {
  onClick: () => void
  label: string
  hidden: boolean
  children: React.ReactNode
}) {
  // 첫 면·마지막 면에서는 버튼을 지우되 자리는 남긴다. 폭까지 사라지면 남은 버튼이
  // 늘어나면서 위치가 바뀌어, 같은 자리를 두 번 누를 수 없게 된다.
  if (hidden) return <div className="h-14 flex-1" aria-hidden />

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-14 flex-1 rounded-lg bg-white text-base font-extrabold text-[#0B1F5C] transition hover:bg-white/85"
    >
      {children}
    </button>
  )
}

/** 확대 버튼. 이동보다는 부차적이라 한 단계 낮은 대비로 두되, 라벨은 똑같이 붙인다. */
function ZoomButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-11 flex-1 rounded-lg bg-white/15 text-sm font-bold text-white transition hover:bg-white/25"
    >
      {children}
    </button>
  )
}
