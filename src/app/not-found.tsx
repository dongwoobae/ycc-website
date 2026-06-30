import Link from 'next/link'
import Container from '@/components/layout/Container'

export default function NotFound() {
  return (
    <div className="py-28 sm:py-36">
      <Container className="max-w-2xl text-center">
        <p className="text-sm font-bold tracking-widest text-accent">404</p>
        <h1 className="mt-4 font-serif text-3xl font-extrabold text-ink sm:text-4xl">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-4 text-ink-muted">
          요청하신 페이지가 이동되었거나 존재하지 않습니다.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper transition hover:opacity-90"
          >
            홈으로
          </Link>
          <Link
            href="/sermons"
            className="rounded-full border border-line px-6 py-3 text-sm font-bold text-ink transition hover:bg-surface"
          >
            설교 보기
          </Link>
        </div>
      </Container>
    </div>
  )
}
