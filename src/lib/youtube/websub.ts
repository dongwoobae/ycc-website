import { createHmac, timingSafeEqual } from 'node:crypto'

export type WebSubNotification =
  | { kind: 'upload'; videoId: string; published: string }
  | { kind: 'deleted' }
  | { kind: 'unknown' }

const HUB = 'https://pubsubhubbub.appspot.com/subscribe'

const tag = (xml: string, name: string): string | null => {
  const m = new RegExp(`<${name}>([^<]+)</${name}>`).exec(xml)
  return m ? m[1] : null
}

/** YouTube WebSub Atom payload에서 videoId/published를 추출한다. */
export function parseWebSubNotification(xml: string): WebSubNotification {
  if (/<at:deleted-entry/.test(xml)) return { kind: 'deleted' }
  const videoId = tag(xml, 'yt:videoId')
  const published = tag(xml, 'published')
  if (videoId && published) return { kind: 'upload', videoId, published }
  return { kind: 'unknown' }
}

/** WebSub hub의 X-Hub-Signature(sha1=...)를 원문 바이트 기준으로 검증한다. */
export function verifyWebSubSignature(rawBody: string | Buffer, header: string | null, secret: string): boolean {
  if (!header) return false
  const expected = 'sha1=' + createHmac('sha1', secret).update(rawBody).digest('hex')
  const actual = Buffer.from(header)
  const expectedBuffer = Buffer.from(expected)
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
}

export function channelTopicUrl(channelId: string): string {
  return `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`
}

export async function subscribeToChannel(opts: {
  channelId: string
  callbackUrl: string
  secret: string
  mode?: 'subscribe' | 'unsubscribe'
}): Promise<void> {
  const form = new URLSearchParams({
    'hub.mode': opts.mode ?? 'subscribe',
    'hub.topic': channelTopicUrl(opts.channelId),
    'hub.callback': opts.callbackUrl,
    'hub.verify': 'async',
    'hub.secret': opts.secret,
  })
  const res = await fetch(HUB, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  if (!res.ok && res.status !== 202) {
    throw new Error(`websub subscribe failed: ${res.status} ${await res.text()}`)
  }
}
