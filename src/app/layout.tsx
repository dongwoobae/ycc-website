import type { Metadata } from 'next'
import { Gowun_Batang } from 'next/font/google'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Analytics } from '@vercel/analytics/next'

const gowunBatang = Gowun_Batang({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-gowun-batang',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://ycch.kr'),
  title: {
    default: '영천중앙교회',
    template: '%s | 영천중앙교회',
  },
  description: '삶의 소망을 주는 은혜로운 영천중앙교회 공식 홈페이지입니다.',
  openGraph: {
    title: '영천중앙교회',
    description: '삶의 소망을 주는 은혜로운 영천중앙교회',
    locale: 'ko_KR',
    siteName: '영천중앙교회',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={gowunBatang.variable}>
      <body className="flex min-h-screen flex-col bg-bg text-ink antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  )
}
