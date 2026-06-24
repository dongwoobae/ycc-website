import type { Metadata } from 'next'
import { Nanum_Myeongjo } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import Footer from '@/components/layout/Footer'
import { Analytics } from '@vercel/analytics/next'

const nanumMyeongjo = Nanum_Myeongjo({
  weight: ['400', '700', '800'],
  variable: '--font-nanum-myeongjo',
  display: 'swap',
  preload: false,
})

const pretendard = localFont({
  src: [
    {
      path: '../../node_modules/pretendard/dist/web/static/woff2/Pretendard-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/pretendard/dist/web/static/woff2/Pretendard-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../node_modules/pretendard/dist/web/static/woff2/Pretendard-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../node_modules/pretendard/dist/web/static/woff2/Pretendard-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../node_modules/pretendard/dist/web/static/woff2/Pretendard-ExtraBold.woff2',
      weight: '800',
      style: 'normal',
    },
  ],
  variable: '--font-pretendard',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://ycjc.kr'),
  title: {
    default: '영천중앙교회',
    template: '%s | 영천중앙교회',
  },
  description: '삶의 소망을 주는 은혜로운 영천중앙교회 공식 홈페이지입니다.',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/brand/ycc-icon.svg', type: 'image/svg+xml' },
      { url: '/brand/ycc-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/brand/ycc-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: '영천중앙교회',
    description: '삶의 소망을 주는 은혜로운 영천중앙교회',
    url: '/',
    locale: 'ko_KR',
    siteName: '영천중앙교회',
    type: 'website',
    images: [
      {
        url: '/brand/ycc-og.png',
        width: 1200,
        height: 630,
        alt: '영천중앙교회',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '영천중앙교회',
    description: '삶의 소망을 주는 은혜로운 영천중앙교회',
    images: ['/brand/ycc-og.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${nanumMyeongjo.variable}`}>
      <body className="flex min-h-screen flex-col bg-bg text-ink antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink focus:shadow-subtle">
          Skip to content
        </a>
        {/* 데스크톱(≥960px)에서는 사이드바가 헤더를 대체, 모바일은 기존 헤더(버거) 유지 */}
        <div className="site-chrome contents min-[960px]:hidden">
          <Header />
        </div>
        <Sidebar />
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  )
}
