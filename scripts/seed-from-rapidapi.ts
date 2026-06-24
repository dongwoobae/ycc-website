import { fetchChannelVideos } from '../src/lib/youtube/rapidapi-channel'
import { classifyByTitle } from '../src/lib/sermons/classify-title'
import { insertSermon } from '../src/lib/sermons/ingest'
import type { WorshipType } from '../src/lib/types'

async function main() {
  const channelId = process.env.YOUTUBE_CHANNEL_ID
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID is not set')
  const maxPages = Number(process.env.SEED_MAX_PAGES ?? 4)

  console.log(`[seed] fetching channel videos (channelId=${channelId}, maxPages=${maxPages})`)
  const videos = await fetchChannelVideos(channelId, maxPages)
  console.log(`[seed] fetched ${videos.length} videos`)

  let inserted = 0
  let skipped = 0
  const byType: Record<string, number> = {}

  for (const video of videos) {
    const worshipType: WorshipType = classifyByTitle(video.title)
    const sermonId = await insertSermon(video, worshipType)
    if (sermonId) {
      inserted++
      byType[worshipType] = (byType[worshipType] ?? 0) + 1
    } else {
      skipped++
    }
  }

  console.log(`[seed] done. inserted=${inserted}, skipped(exists)=${skipped}`)
  console.log('[seed] by worshipType:', byType)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
