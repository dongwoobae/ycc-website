// 사이트 정적 이미지를 R2 `static/` 프리픽스로 업로드한다. (서빙 헬퍼: src/lib/static-images.ts)
// 사용법: npx tsx --env-file=.env.local scripts/upload-static-images.ts <소스 디렉터리>
// 소스 디렉터리 아래의 상대 경로가 그대로 R2 키가 된다.
// 예: <소스>/images/entry/word.webp → static/images/entry/word.webp
// 같은 키로 재업로드하면 교체된다(캐시 1일이라 하루 안에 반영).
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2]
if (!root) {
  console.error('소스 디렉터리를 지정하세요: tsx scripts/upload-static-images.ts <dir>')
  process.exit(1)
}

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
  },
  // src/lib/r2.ts 와 동일 — R2 는 v3 기본 CRC32 체크섬에서 SignatureDoesNotMatch 를 낸다
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const bucket = process.env.R2_BUCKET_NAME!.trim()
const publicUrl = process.env.R2_PUBLIC_URL!.trim().replace(/\/+$/, '')

async function main() {
  const files = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath, d.name))
  let uploaded = 0
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/')
    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase()
    const contentType = CONTENT_TYPES[ext]
    if (!contentType) {
      console.log(`skip  ${rel} (지원하지 않는 확장자)`)
      continue
    }
    const key = `static/${rel}`
    const body = readFileSync(file)
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=86400',
      })
    )
    uploaded++
    console.log(`ok  ${publicUrl}/${key}  (${body.length} bytes)`)
  }
  console.log(`done: ${uploaded}/${files.length} files`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
