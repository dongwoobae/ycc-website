import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import BulletinView from '@/components/bulletins/BulletinView'
import { getBulletinById, getBulletins } from '@/lib/data/bulletins'
import JsonLd from '@/components/seo/JsonLd'
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
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
  return {
    title: `${bulletin.bulletinDate} 주보`,
    description: `${churchInfo.name} ${bulletin.bulletinDate} 주보입니다.`,
    alternates: {
      canonical: `/bulletins/${bulletin.id}`,
    },
  }
}

export default async function BulletinDetailPage({ params }: BulletinDetailProps) {
  const { id } = await params
  const bulletin = await getBulletinById(id)
  if (!bulletin) notFound()

  return (
    <div className="py-12">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '주보', path: '/bulletins' },
          { name: `${bulletin.bulletinDate} 주보`, path: `/bulletins/${bulletin.id}` },
        ])}
      />
      <Container className="max-w-5xl">
        <BulletinView bulletin={bulletin} />
      </Container>
    </div>
  )
}
