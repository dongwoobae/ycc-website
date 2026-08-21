import { config } from 'dotenv'

config({ path: '.env.local' })

import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

// bulletins/ 프리픽스에서 새 키 규칙에 맞지 않는 객체를 찾아 나열한다.
// 새 규칙: bulletins/{YYYY-MM-DD}/{uploadId}/...
// 과거 규칙: bulletins/{uuid}-{파일명}.hwp  ← 이번에 폐기됨
//
// 기본은 조회만 한다. 지우려면 --delete 를 준다.
//
// 실행: npx tsx scripts/audit-bulletin-r2.ts [--delete]
//
// src/lib/r2.ts 의 listR2Keys/deleteFromR2 를 쓰지 않는 이유: 그 모듈은 'server-only' 라
// tsx 에서 import 할 수 없다. cleanup-thumbnails.ts 와 같은 방식으로 클라이언트를 직접 만든다.

const currentKeyPattern = /^bulletins\/\d{4}-\d{2}-\d{2}\/[0-9a-fA-F-]+\/.+$/

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

async function listKeys(client: S3Client, bucket: string, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    )
    for (const obj of res.Contents ?? []) if (obj.Key) keys.push(obj.Key)
    token = res.NextContinuationToken
  } while (token)
  return keys
}

async function main() {
  const shouldDelete = process.argv.includes('--delete')
  const bucket = requireEnv('R2_BUCKET_NAME')
  const client = makeR2Client()

  const keys = await listKeys(client, bucket, 'bulletins/')
  const orphans = keys.filter((key) => !currentKeyPattern.test(key))

  console.log(`bulletins/ 전체 객체: ${keys.length}개`)
  console.log(`새 키 규칙에 맞지 않는 객체: ${orphans.length}개`)
  for (const key of orphans) console.log(`  ${key}`)

  if (orphans.length === 0) return
  if (!shouldDelete) {
    console.log('\n삭제하려면 --delete 를 붙여 다시 실행하세요.')
    return
  }

  for (const key of orphans) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    console.log(`deleted ${key}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
