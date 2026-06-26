import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const { db } = await import('../src/lib/db')
  const schema = await import('../src/lib/db/schema')
  const { getSermons } = await import('../src/lib/seed/sermons')
  const { getBulletins } = await import('../src/lib/seed/bulletins')
  const { getGalleryAlbums } = await import('../src/lib/seed/gallery')
  const { getPosts } = await import('../src/lib/seed/posts')

  // 기존 데이터 정리 (자식 → 부모 순서)
  await db.delete(schema.galleryImages)
  await db.delete(schema.galleryAlbums)
  await db.delete(schema.sermons)
  await db.delete(schema.posts)
  await db.delete(schema.bulletins)

  const sermons = await getSermons()
  for (const s of sermons) {
    const [row] = await db
      .insert(schema.sermons)
      .values({
        title: s.title,
        preacher: s.preacher,
        worshipType: s.worshipType,
        sermonDate: s.sermonDate,
        videoUrl: s.videoUrl,
        isPublished: s.isPublished,
      })
      .returning({ id: schema.sermons.id })
    // summary는 위성(SoT)에 저장, 자막/썸네일은 기본 행만 생성
    await db.insert(schema.sermonSummaries).values({ sermonId: row.id, summary: s.summary ?? null }).onConflictDoNothing()
    await db.insert(schema.sermonTranscripts).values({ sermonId: row.id }).onConflictDoNothing()
    await db.insert(schema.sermonThumbnails).values({ sermonId: row.id }).onConflictDoNothing()
  }

  const bulletins = await getBulletins()
  for (const b of bulletins) {
    await db.insert(schema.bulletins).values({
      bulletinDate: b.bulletinDate,
      volume: b.volume,
      issue: b.issue,
      theme: b.theme,
      scripture: b.scripture,
      sections: b.sections,
      isPublished: b.isPublished,
    })
  }

  const posts = await getPosts()
  for (const p of posts) {
    await db.insert(schema.posts).values({
      title: p.title,
      content: p.content,
      category: p.category,
      isPinned: p.isPinned,
      publishedAt: new Date(p.publishedAt),
      isPublished: true,
    })
  }

  const albums = await getGalleryAlbums()
  for (const a of albums) {
    const [row] = await db
      .insert(schema.galleryAlbums)
      .values({
        title: a.title,
        description: a.description ?? null,
        coverImgUrl: a.coverImgUrl,
        eventDate: a.eventDate,
        isPublished: a.isPublished,
      })
      .returning({ id: schema.galleryAlbums.id })
    for (let i = 0; i < a.images.length; i++) {
      const img = a.images[i]
      await db.insert(schema.galleryImages).values({
        albumId: row.id,
        imageUrl: img.imageUrl,
        caption: img.caption ?? null,
        alt: img.alt ?? null,
        sortOrder: i,
      })
    }
  }

  console.log('Seed 완료:', {
    sermons: sermons.length,
    bulletins: bulletins.length,
    posts: posts.length,
    albums: albums.length,
  })
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
