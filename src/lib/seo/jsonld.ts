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

/** 한국 표준시 오프셋. 예배 날짜는 모두 KST 기준이다. */
const KST_OFFSET = '+09:00'

/**
 * `uploadDate`를 시간대 포함 ISO 8601로 정규화한다. Google VideoObject는 오프셋 없는
 * 값을 "시간대 누락"·"잘못된 값"으로 경고하므로 항상 오프셋을 붙인다.
 * - `YYYY-MM-DD` → `YYYY-MM-DDT00:00:00+09:00`
 * - 이미 시간대(Z 또는 ±hh:mm) 포함 → 그대로 사용
 * - 파싱 불가·빈 값 → undefined (호출측에서 uploadDate 생략)
 */
export function normalizeUploadDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00${KST_OFFSET}`
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed
  const t = Date.parse(trimmed)
  return Number.isNaN(t) ? undefined : new Date(t).toISOString()
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
  }
  const uploadDate = normalizeUploadDate(input.uploadDate)
  if (uploadDate) video.uploadDate = uploadDate
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
