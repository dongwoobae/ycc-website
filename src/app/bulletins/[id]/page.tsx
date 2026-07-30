import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import BulletinView from '@/components/bulletins/BulletinView'
import { getAdjacentBulletins, getBulletinById, getBulletins } from '@/lib/data/bulletins'
import JsonLd from '@/components/seo/JsonLd'
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import { formatBulletinDate } from '@/lib/bulletin-format'
import { churchInfo } from '@/lib/church'

export const revalidate = 3600

interface BulletinDetailProps {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  const bulletins = await getBulletins()
  return bulletins.map((bulletin) => ({ id: bulletin.id }))
}

export async function generateMetadata({ params }: BulletinDetailProps): Promise<Metadata> {
  const { id } = await params
  const bulletin = await getBulletinById(id)
  if (!bulletin) return { title: '주보' }

  const label = formatBulletinDate(bulletin.bulletinDate)
  const cover = bulletin.pages[0]?.previewUrl
  return {
    title: `${label} 주보`,
    description: bulletin.sermonTitle
      ? `${churchInfo.name} ${label} 주보 — ${bulletin.sermonTitle}`
      : `${churchInfo.name} ${label} 주보입니다.`,
    alternates: {
      canonical: `/bulletins/${bulletin.id}`,
    },
    // 표지 이미지가 있으면 OG 로 쓴다. 없으면 레이아웃의 기본 OG 로 폴백된다.
    ...(cover ? { openGraph: { images: [{ url: cover }] } } : {}),
  }
}

export default async function BulletinDetailPage({ params }: BulletinDetailProps) {
  const { id } = await params
  const bulletin = await getBulletinById(id)
  if (!bulletin) notFound()

  const { previous, next } = await getAdjacentBulletins(bulletin.bulletinDate)
  const label = formatBulletinDate(bulletin.bulletinDate)

  return (
    <div className="py-12">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '주보', path: '/bulletins' },
          { name: `${label} 주보`, path: `/bulletins/${bulletin.id}` },
        ])}
      />
      <Container size="wide">
        <BulletinView bulletin={bulletin} previous={previous} next={next} />
      </Container>
    </div>
  )
}
