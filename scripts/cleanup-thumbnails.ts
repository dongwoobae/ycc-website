import { config } from 'dotenv'

config({ path: '.env.local' })

import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { neon } from '@neondatabase/serverless'

// R2 thumbnails/ 저장소 일회성 정리 스크립트. 두 단계로 동작한다:
//   1) 트림 로직 도입 이전에 무한 append 된 thumbnail_candidates 를 최근 N건으로 트림
//   2) 트림 후 DB 어디에서도 참조하지 않는 R2 고아 객체 삭제
// 기본은 dry-run으로 목록만 출력하고, 실제 반영은 --apply 플래그를 붙인다.

// src/lib/thumbnails/store.ts 의 MAX_THUMBNAIL_CANDIDATES 와 같은 값.
// (store.ts 는 server-only 라 tsx 에서 import 불가)
const MAX_CANDIDATES = 3

interface CandidateRow {
  id: string
  custom_thumbnail_url: string | null
  thumbnail_backgrounds: Record<string, string> | null
  thumbnail_cutout_url: string | null
  thumbnail_candidates: Array<{ url?: string }> | null
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} 가 .env.local 에 없음`)
  return value
}

function makeR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
    // src/lib/r2.ts와 동일 — R2는 aws-sdk v3 기본 체크섬과 호환되지 않는다.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

async function listThumbnailKeys(client: S3Client, bucket: string): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: 'thumbnails/', ContinuationToken: token })
    )
    for (const obj of res.Contents ?? []) if (obj.Key) keys.push(obj.Key)
    token = res.NextContinuationToken
  } while (token)
  return keys
}

async function main() {
  const apply = process.argv.includes('--apply')
  const publicUrl = requireEnv('R2_PUBLIC_URL').replace(/\/+$/, '')
  const bucket = requireEnv('R2_BUCKET_NAME')
  const client = makeR2Client()
  const sql = neon(requireEnv('DATABASE_URL'))

  const rows = (await sql`
    SELECT s.id, s.custom_thumbnail_url, t.thumbnail_backgrounds, t.thumbnail_cutout_url, t.thumbnail_candidates
    FROM sermons s
    LEFT JOIN sermon_thumbnails t ON t.sermon_id = s.id
  `) as CandidateRow[]

  // 1단계: 후보 배열을 최근 N건으로 트림 (트림 후 남는 것만 "참조"로 취급)
  const referenced = new Set<string>()
  const addReferenced = (url: unknown) => {
    if (typeof url !== 'string' || !url.startsWith(`${publicUrl}/`)) return
    referenced.add(url.slice(publicUrl.length + 1))
  }

  let trimmedRows = 0
  let trimmedEntries = 0
  for (const row of rows) {
    addReferenced(row.custom_thumbnail_url)
    addReferenced(row.thumbnail_cutout_url)
    for (const url of Object.values(row.thumbnail_backgrounds ?? {})) addReferenced(url)

    const candidates = row.thumbnail_candidates ?? []
    const kept = candidates.slice(-MAX_CANDIDATES)
    for (const candidate of kept) addReferenced(candidate?.url)

    if (candidates.length > MAX_CANDIDATES) {
      trimmedRows += 1
      trimmedEntries += candidates.length - kept.length
      console.log(`트림: sermon=${row.id} 후보 ${candidates.length}건 → ${kept.length}건`)
      if (apply) {
        await sql`
          UPDATE sermon_thumbnails
          SET thumbnail_candidates = ${JSON.stringify(kept)}::jsonb
          WHERE sermon_id = ${row.id}
        `
      }
    }
  }

  // 2단계: 참조되지 않는 R2 객체 삭제 (트림으로 밀려난 옛 생성본 포함)
  const all = await listThumbnailKeys(client, bucket)
  const orphans = all.filter((key) => !referenced.has(key))

  console.log(
    `\n후보 트림 대상 ${trimmedRows}행/${trimmedEntries}건, thumbnails/ 전체 ${all.length}건, 참조 유지 ${referenced.size}건, 삭제 대상 ${orphans.length}건`
  )
  for (const key of orphans) console.log(`  ${key}`)

  if (!apply) {
    console.log('\ndry-run — 실제 반영하려면 --apply 를 붙이세요.')
    return
  }
  for (const key of orphans) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    console.log(`삭제됨: ${key}`)
  }
  console.log(`정리 완료: DB 트림 ${trimmedRows}행, R2 삭제 ${orphans.length}건`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
