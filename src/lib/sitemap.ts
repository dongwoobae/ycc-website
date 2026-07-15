import type { MetadataRoute } from 'next'
import { absoluteUrl } from './site-origin'

interface SitemapContent {
  sermons: { id: string; sermonDate: string }[]
  posts: { id: string; publishedAt: string }[]
  bulletins: { id: string; bulletinDate: string }[]
  albums: { id: string; eventDate: string }[]
}

const staticRoutes = [
  '/',
  '/newfamily',
  '/about',
  '/about/greeting',
  '/about/history',
  '/about/serving',
  '/worship',
  '/happiness',
  '/faq',
  '/sermons',
  '/praise',
  '/events',
  '/news',
  '/bulletins',
  '/gallery',
] as const

function dateOrUndefined(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function buildSitemapEntries(content: SitemapContent, origin?: string): MetadataRoute.Sitemap {
  const entry = (path: string, lastModified?: string) => ({
    url: absoluteUrl(path, origin),
    lastModified: lastModified ? dateOrUndefined(lastModified) : undefined,
  })

  return [
    ...staticRoutes.map((route) => entry(route)),
    ...content.sermons.map((sermon) => entry(`/sermons/${sermon.id}`, sermon.sermonDate)),
    ...content.posts.map((post) => entry(`/news/${post.id}`, post.publishedAt)),
    ...content.bulletins.map((bulletin) => entry(`/bulletins/${bulletin.id}`, bulletin.bulletinDate)),
    ...content.albums.map((album) => entry(`/gallery/${album.id}`, album.eventDate)),
  ]
}
