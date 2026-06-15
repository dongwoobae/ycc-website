import Link from 'next/link'
import Container from './Container'
import { churchInfo } from '@/lib/church'

const worshipItems = ['주일예배: 주일 오전 11:00', '찬양예배: 주일 오후 2:00', '수요예배: 수요일 오후 7:30', '새벽기도: 매주일 오전 5:00']

const menuLinks = [
  { label: '처음 오세요', href: '/newfamily' },
  { label: '설교', href: '/sermons' },
  { label: '주보', href: '/bulletins' },
  { label: '교회소식', href: '/news' },
  { label: '갤러리', href: '/gallery' },
  { label: '오시는 길', href: '/#visit' },
]

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-bg">
      <Container size="wide" className="grid gap-10 py-16 text-sm text-ink-muted md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">영천중앙교회</h2>
          <p className="mt-4 max-w-[36ch] leading-7">
            삶의 닻을 주는 교회. 말씀과 예배, 서로를 돌보는 공동체로 영천의 이웃과 함께 걷습니다.
          </p>
          <address className="mt-5 not-italic leading-7">
            {churchInfo.address}
            <br />
            전화 {churchInfo.phone}
          </address>
        </div>

        <div>
          <h3 className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-accent">Worship</h3>
          <ul className="mt-4 space-y-2">
            {worshipItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-accent">Menu</h3>
          <ul className="mt-4 space-y-2">
            {menuLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="border-t border-line">
        <Container size="wide" className="flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-faint">
          <span>© {new Date().getFullYear()} 영천중앙교회. All rights reserved.</span>
          <span>대한예수교장로회</span>
        </Container>
      </div>
    </footer>
  )
}
