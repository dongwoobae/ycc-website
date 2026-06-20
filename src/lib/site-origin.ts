import { normalizeOrigin } from './auth-origin'

export const DEFAULT_SITE_ORIGIN = 'https://ycch.kr'

export function getCanonicalSiteOrigin() {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeOrigin(process.env.SITE_URL) ||
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeOrigin(process.env.VERCEL_URL) ||
    DEFAULT_SITE_ORIGIN
  )
}

export function absoluteUrl(path: string, origin = getCanonicalSiteOrigin()) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${origin}${normalizedPath}`
}
