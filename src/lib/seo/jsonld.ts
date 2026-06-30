import { churchInfo } from '@/lib/church'
import { absoluteUrl, getCanonicalSiteOrigin } from '@/lib/site-origin'

export const CHURCH_NAME = '영천중앙교회'

type JsonLdObject = Record<string, unknown>

export function buildChurchJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: CHURCH_NAME,
    url: getCanonicalSiteOrigin(),
    logo: absoluteUrl('/brand/pck-icon-512.png'),
    image: absoluteUrl('/brand/pck-og.png'),
    telephone: churchInfo.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: churchInfo.address,
      addressCountry: 'KR',
    },
    sameAs: [churchInfo.youtube, churchInfo.blog],
  }
}

export function secondsToIsoDuration(seconds: number | undefined): string | undefined {
  if (!seconds || seconds < 1) return undefined
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s ? `${s}S` : ''}`
}

export interface SermonVideoInput {
  name: string
  uploadDate: string
  description?: string
  thumbnailUrl?: string
  youtubeId?: string
  durationSeconds?: number
}

export function buildSermonVideoJsonLd(input: SermonVideoInput): JsonLdObject {
  const video: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: input.name,
    uploadDate: input.uploadDate,
  }
  if (input.description) video.description = input.description
  if (input.thumbnailUrl) video.thumbnailUrl = input.thumbnailUrl
  if (input.youtubeId) {
    video.embedUrl = `https://www.youtube.com/embed/${input.youtubeId}`
    video.contentUrl = `https://www.youtube.com/watch?v=${input.youtubeId}`
  }
  const duration = secondsToIsoDuration(input.durationSeconds)
  if (duration) video.duration = duration
  return video
}

export interface BreadcrumbItem {
  name: string
  path: string
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
