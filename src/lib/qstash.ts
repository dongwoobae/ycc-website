import { Client, Receiver } from '@upstash/qstash'
import { getCanonicalSiteOrigin } from './site-origin'

export type JobName = 'ingest-video' | 'fetch-transcript' | 'summarize'

function baseUrl(): string {
  return getCanonicalSiteOrigin()
}

const client = () => new Client({ token: process.env.QSTASH_TOKEN! })

/** QStash 작업 발행. SDK 숫자 delay는 초 단위로 Upstash-Delay 헤더에 변환된다. */
export async function publishJob(job: JobName, body: unknown, delaySeconds = 0): Promise<void> {
  await client().publishJSON({
    url: `${baseUrl()}/api/jobs/${job}`,
    body,
    ...(delaySeconds > 0 ? { delay: delaySeconds } : {}),
  })
}

const receiver = () =>
  new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  })

export async function verifyQStash(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false
  try {
    return await receiver().verify({ body: rawBody, signature })
  } catch {
    return false
  }
}

export const RETRY_DELAY_SECONDS = 30 * 60
