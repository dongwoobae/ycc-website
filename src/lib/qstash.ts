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

/** 이 저장소가 소유하는 스케줄의 ID 접두사. */
const MANAGED_PREFIX = 'ycc-'

export interface ManagedSchedule {
  job: JobName
  cron: string
  scheduleId: string
}

/**
 * ycc- 스케줄의 desired set을 QStash에 적용한다.
 *
 * create만 하면 스크립트에서 항목을 지우거나 ID를 바꿔도 QStash에는 옛 스케줄이 남아
 * 계속 실행된다 — 중복 폴링·중복 로그·쿼터 소모가 조용히 이어진다. 그래서 삭제까지 여기서 한다.
 *
 * `desired`가 비거나 접두사 없는 ID를 담고 있으면 배열 편집 실수일 뿐 정당한 입력이 아니다 —
 * 비어 있으면 관리 대상 전체가 삭제 후보가 되고, 접두사가 없으면 그 스케줄은 desired에서
 * 빠져도 삭제 대상으로 잡히지 않아 영원히 고아로 남는다. 둘 다 호출 전에 막는다.
 *
 * `apply`가 false면 등록(create, 멱등)까지는 그대로 하되 삭제는 건너뛰고 후보만 `staleManaged`로
 * 돌려준다 — 삭제만 실행 취소가 안 되는 연산이라 이 스크립트의 형제들(cleanup-thumbnails.ts,
 * audit-bulletin-r2.ts)과 같은 기본값을 쓴다.
 */
export async function syncSchedules(
  desired: ManagedSchedule[],
  apply: boolean,
): Promise<{ upserted: string[]; deleted: string[]; staleManaged: string[] }> {
  if (desired.length === 0) {
    throw new Error('syncSchedules: desired가 비었다 — 관리 대상 ycc- 스케줄 전체가 삭제 후보가 된다')
  }
  for (const s of desired) {
    if (!s.scheduleId.startsWith(MANAGED_PREFIX)) {
      throw new Error(`syncSchedules: "${s.scheduleId}"가 ${MANAGED_PREFIX} 접두사가 아니다`)
    }
  }

  const c = client()
  for (const s of desired) {
    await c.schedules.create({
      destination: `${baseUrl()}/api/jobs/${s.job}`,
      cron: s.cron,
      scheduleId: s.scheduleId,
    })
  }

  const wanted = new Set(desired.map((s) => s.scheduleId))
  const staleManaged: string[] = []
  for (const s of await c.schedules.list()) {
    if (!s.scheduleId.startsWith(MANAGED_PREFIX) || wanted.has(s.scheduleId)) continue
    staleManaged.push(s.scheduleId)
  }

  const deleted: string[] = []
  if (apply) {
    for (const id of staleManaged) {
      await c.schedules.delete(id)
      deleted.push(id)
    }
  }
  return { upserted: desired.map((s) => s.scheduleId), deleted, staleManaged }
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
