import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import BulletinView from '@/components/bulletins/BulletinView'
import { getBulletinById } from '@/lib/data/bulletins'

interface BulletinDetailProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: BulletinDetailProps): Promise<Metadata> {
  const { id } = await params
  const bulletin = await getBulletinById(id)
  return {
    title: bulletin ? `${bulletin.bulletinDate} 주보` : '주보',
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function BulletinDetailPage({ params }: BulletinDetailProps) {
  const { id } = await params
  const bulletin = await getBulletinById(id)
  if (!bulletin) notFound()

  return (
    <div className="py-12">
      <Container className="max-w-5xl">
        <BulletinView bulletin={bulletin} />
      </Container>
    </div>
  )
}
