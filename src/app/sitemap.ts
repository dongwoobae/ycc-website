import type { MetadataRoute } from 'next'
import { getBulletins } from '@/lib/data/bulletins'
import { getGalleryAlbums } from '@/lib/data/gallery'
import { getPosts } from '@/lib/data/posts'
import { getSermons } from '@/lib/data/sermons'
import { buildSitemapEntries } from '@/lib/sitemap'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [sermons, posts, bulletins, albums] = await Promise.all([
    getSermons(),
    getPosts(),
    getBulletins(),
    getGalleryAlbums(),
  ])

  return buildSitemapEntries({ sermons, posts, bulletins, albums })
}
