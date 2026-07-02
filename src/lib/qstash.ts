import { Client, Receiver } from '@upstash/qstash'
import { getCanonicalSiteOrigin } from './site-origin'

export type JobName =
  | 'ingest-video'
  | 'fetch-transcript'
  | 'summarize'
  | 'websub-renew'
  | 'retry-summaries'
  | 'reconcile-sermons'
  | 'analytics-rollup'

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

/**
 * QStash 정기 스케줄을 멱등 등록한다. scheduleId 고정이라 재실행 시 중복 없이 갱신된다.
 * (scripts/qstash-schedules.ts에서 호출 — WebSub 갱신·요약 재시도 cron)
 */
export async function upsertSchedule(opts: { job: JobName; cron: string; scheduleId: string }): Promise<void> {
  await client().schedules.create({
    destination: `${baseUrl()}/api/jobs/${opts.job}`,
    cron: opts.cron,
    scheduleId: opts.scheduleId,
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
