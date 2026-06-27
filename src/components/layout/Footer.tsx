import Link from 'next/link'
import Image from 'next/image'
import Container from './Container'
import { churchInfo } from '@/lib/church'
import { adultWorshipSchedule } from '@/lib/worship'

const menuLinks = [
  { label: '처음 오세요', href: '/newfamily' },
  { label: '설교', href: '/sermons' },
  { label: '주보', href: '/bulletins' },
  { label: '교회소식', href: '/news' },
  { label: '갤러리', href: '/gallery' },
  { label: '오시는 길', href: '/about/visit' },
]

const socialLinks = [
  { label: '유튜브', href: churchInfo.youtube, src: '/images/social/youtube.webp', w: 136, h: 96 },
  { label: '네이버 블로그', href: churchInfo.blog, src: '/images/social/naver-blog.webp', w: 100, h: 96 },
  { label: '디모데앱', href: churchInfo.dimode, src: '/images/social/dimode.webp', w: 96, h: 96 },
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

          <div className="mt-6 flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                title={social.label}
                className="inline-flex transition hover:opacity-75"
              >
                <Image
                  src={social.src}
                  alt={social.label}
                  width={social.w}
                  height={social.h}
                  unoptimized
                  className="h-8 w-auto"
                />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-accent">Worship</h3>
          <ul className="mt-4 space-y-2">
            {adultWorshipSchedule.slice(0, 4).map((item) => (
              <li key={item.name}>
                {item.name}: {item.displayTime}
              </li>
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
