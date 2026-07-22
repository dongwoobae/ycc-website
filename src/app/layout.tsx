import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Analytics } from '@vercel/analytics/next'
import { getCanonicalSiteOrigin } from '@/lib/site-origin'
import JsonLd from '@/components/seo/JsonLd'
import { buildChurchJsonLd } from '@/lib/seo/jsonld'
import Tracker from '@/components/analytics/Tracker'
import { churchInfo } from '@/lib/church'

const GOOGLE_ANALYTICS_ID = 'G-Y1121E1MQ9'

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
  metadataBase: new URL(getCanonicalSiteOrigin()),
  title: {
    default: churchInfo.name,
    template: `%s | ${churchInfo.name}`,
  },
  description: churchInfo.description,
  verification: {
    google: 'i76ulv_84QEDrKNinruYNDKmrFlGOQ7c4XbdKbCoieI',
    other: {
      'naver-site-verification': 'dc46e2a53ca91db1adf4bd46e21b57128bd835b4',
    },
  },
  icons: {
    icon: [
      { url: '/brand/pck-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/pck-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/brand/pck-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: churchInfo.name,
    description: churchInfo.description,
    locale: 'ko_KR',
    siteName: churchInfo.englishName,
    type: 'website',
    images: [
      {
        url: '/brand/pck-og.png',
        width: 1200,
        height: 630,
        alt: `${churchInfo.englishName} ${churchInfo.name}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: churchInfo.name,
    description: churchInfo.description,
    images: ['/brand/pck-og.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="flex min-h-screen flex-col bg-bg text-ink antialiased">
        <JsonLd data={buildChurchJsonLd()} />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink focus:shadow-subtle">
          Skip to content
        </a>
        <div className="site-chrome contents">
          <Header />
        </div>
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
        <Tracker />
        <Analytics />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ANALYTICS_ID}');
          `}
        </Script>
      </body>
    </html>
  )
}
