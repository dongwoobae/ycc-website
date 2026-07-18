import Link from 'next/link'
import Image from 'next/image'
import Container from './Container'
import { churchInfo } from '@/lib/church'
import { adultWorshipSchedule } from '@/lib/worship'
import { staticImg } from '@/lib/static-images'

const menuLinks = [
  { label: '소개', href: '/about' },
  { label: '안내', href: '/worship' },
  { label: '말씀과 찬양', href: '/sermons' },
  { label: '처음 오셨나요?', href: '/newfamily' },
  { label: '소식', href: '/news' },
  { label: '주보', href: '/bulletins' },
]

const socialLinks = [
  { label: '유튜브', href: churchInfo.youtube, src: staticImg('/images/social/youtube.webp'), w: 136, h: 96 },
  { label: '네이버 블로그', href: churchInfo.blog, src: staticImg('/images/social/naver-blog.webp'), w: 100, h: 96 },
  { label: '디모데앱', href: churchInfo.dimode, src: staticImg('/images/social/dimode.webp'), w: 96, h: 96 },
]

export default function Footer() {
  return (
    <footer className="mt-auto bg-navy-deep text-white/70">
      <Container size="wide" className="grid gap-10 py-16 text-sm md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">{churchInfo.name}</h2>
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
                className="inline-flex opacity-80 transition hover:opacity-100"
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
          <h3 className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-gold">Worship</h3>
          <ul className="mt-4 space-y-2">
            {adultWorshipSchedule.slice(0, 4).map((item) => (
              <li key={item.name}>
                {item.name}: {item.displayTime}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-gold">Menu</h3>
          <ul className="mt-4 space-y-2">
            {menuLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container size="wide" className="flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-white/45">
          <span>© {new Date().getFullYear()} {churchInfo.name}. All rights reserved.</span>
          <span>{churchInfo.denomination}</span>
        </Container>
      </div>
    </footer>
  )
}
