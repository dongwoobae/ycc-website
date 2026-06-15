import Link from 'next/link'
import Container from './Container'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <Container className="grid gap-10 py-12 text-sm text-ink-muted md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <h2 className="font-serif text-2xl font-bold text-ink">영천중앙교회</h2>
          <p className="mt-4 leading-7">
            삶의 소망을 주는 은혜로운 교회. 구역이 살아나고 지역 사회를 섬기는 교회로
            함께 걷습니다.
          </p>
          <p className="mt-4">경북 영천시 완산중앙8길 21</p>
          <p>전화 337-5692 / 팩스 337-5693</p>
        </div>
        <div>
          <h3 className="font-semibold text-ink">예배 안내</h3>
          <ul className="mt-4 space-y-2">
            <li>주일예배: 주일 오전 11시</li>
            <li>찬양예배: 주일 오후 2시</li>
            <li>수요예배: 수요일 오후 7시 30분</li>
            <li>새벽기도: 화-주일 오전 5시</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-ink">바로가기</h3>
          <ul className="mt-4 space-y-2">
            <li>
              <Link href="/sermons" className="hover:text-accent">
                예배·설교
              </Link>
            </li>
            <li>
              <Link href="/bulletins" className="hover:text-accent">
                주보
              </Link>
            </li>
            <li>
              <Link href="/about/visit" className="hover:text-accent">
                오시는 길
              </Link>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-line py-5 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} 영천중앙교회. All rights reserved.
      </div>
    </footer>
  )
}
