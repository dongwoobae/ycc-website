import { Client, Receiver } from '@upstash/qstash'
import { getCanonicalSiteOrigin } from './site-origin'

export type JobName =
  | 'ingest-video'
  | 'fetch-transcript'
  | 'fetch-audio-transcript'
  | 'summarize'
  | 'websub-renew'
  | 'retry-summaries'
  | 'reconcile-sermons'
  | 'analytics-rollup'
  | 'publish-post'

function baseUrl(): string {
  return getCanonicalSiteOrigin()
}

const client = () => new Client({ token: process.env.QSTASH_TOKEN! })

/** 생략한 항목은 QStash 계정/플랜 기본값을 따른다. */
export interface JobPublishOptions {
  /** 2xx 밖 응답·미응답 시 QStash가 재전달하는 횟수 상한. */
  retries?: number
  /** QStash가 대상 함수의 응답을 기다리는 시간(초). 함수의 maxDuration보다 짧으면 정상 처리 중인 호출도 실패로 보고 재전달한다. */
  timeoutSeconds?: number
}

/** QStash 작업 발행. SDK 숫자 delay는 초 단위로 Upstash-Delay 헤더에 변환된다. */
export async function publishJob(
  job: JobName,
  body: unknown,
  delaySeconds = 0,
  options: JobPublishOptions = {},
): Promise<void> {
  await client().publishJSON({
    url: `${baseUrl()}/api/jobs/${job}`,
    body,
    ...(delaySeconds > 0 ? { delay: delaySeconds } : {}),
    ...(options.retries != null ? { retries: options.retries } : {}),
    ...(options.timeoutSeconds != null ? { timeout: options.timeoutSeconds } : {}),
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
