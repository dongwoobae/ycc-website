import 'dotenv/config'
import { subscribeToChannel } from '../src/lib/youtube/websub'

async function main() {
  await subscribeToChannel({
    channelId: process.env.YOUTUBE_CHANNEL_ID!,
    callbackUrl: process.env.WEBSUB_CALLBACK_URL!,
    secret: process.env.WEBSUB_SECRET!,
  })
  console.log('subscribe request sent (hub will verify via callback)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
