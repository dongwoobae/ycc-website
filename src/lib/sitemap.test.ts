import { describe, expect, it } from 'vitest'
import { buildSitemapEntries } from './sitemap'

describe('buildSitemapEntries', () => {
  it('builds static and published content URLs from the supplied data', () => {
    const entries = buildSitemapEntries(
      {
        sermons: [{ id: 'sermon-1', sermonDate: '2026-06-07' }],
        posts: [{ id: 'post-1', publishedAt: '2026-06-08' }],
        bulletins: [{ id: 'bulletin-1', bulletinDate: '2026-06-09' }],
        albums: [{ id: 'album-1', eventDate: '2026-06-10' }],
      },
      'https://example.com'
    )

    expect(entries.map((entry) => entry.url)).toEqual(
      expect.arrayContaining([
        'https://example.com/',
        'https://example.com/sermons',
        'https://example.com/sermons/sermon-1',
        'https://example.com/news/post-1',
        'https://example.com/bulletins/bulletin-1',
        'https://example.com/gallery/album-1',
      ])
    )
    expect(entries.find((entry) => entry.url.endsWith('/sermons/sermon-1'))?.lastModified).toEqual(
      new Date('2026-06-07')
    )
  })
})
