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

/** 이 저장소가 소유하는 스케줄의 ID 접두사. 이 접두사가 아닌 것은 지우지 않는다. */
const MANAGED_PREFIX = 'ycc-'

export interface ManagedSchedule {
  job: JobName
  cron: string
  scheduleId: string
}

/**
 * ycc- 스케줄의 desired set을 QStash에 적용한다(멱등).
 *
 * create만 하면 스크립트에서 항목을 지우거나 ID를 바꿔도 QStash에는 옛 스케줄이 남아
 * 계속 실행된다 — 중복 폴링·중복 로그·쿼터 소모가 조용히 이어진다. 그래서 삭제까지 여기서 한다.
 */
export async function syncSchedules(
  desired: ManagedSchedule[],
): Promise<{ upserted: string[]; deleted: string[] }> {
  const c = client()
  for (const s of desired) {
    await c.schedules.create({
      destination: `${baseUrl()}/api/jobs/${s.job}`,
      cron: s.cron,
      scheduleId: s.scheduleId,
    })
  }

  const wanted = new Set(desired.map((s) => s.scheduleId))
  const deleted: string[] = []
  for (const s of await c.schedules.list()) {
    if (!s.scheduleId.startsWith(MANAGED_PREFIX) || wanted.has(s.scheduleId)) continue
    await c.schedules.delete(s.scheduleId)
    deleted.push(s.scheduleId)
  }
  return { upserted: desired.map((s) => s.scheduleId), deleted }
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
