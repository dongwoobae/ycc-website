import { config } from 'dotenv'

config({ path: '.env.local' })

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { neon } from '@neondatabase/serverless'

// 표지가 앨범 사진에 포함되도록 바뀌기 전에 만들어진 앨범을 채우는 일회성 스크립트.
// 표지 R2 객체를 새 키로 복사해 사진 행으로 맨 앞(sort_order 0)에 넣는다.
// 표지와 사진이 한 객체를 공유하면 한쪽 삭제가 다른 쪽을 지우므로 반드시 복사한다.
//
// 사용법:
//   tsx scripts/backfill-album-cover-images.ts                 앨범 목록만 출력
//   tsx scripts/backfill-album-cover-images.ts --id <uuid>...  대상 앨범 dry-run
//   tsx scripts/backfill-album-cover-images.ts --id <uuid>... --apply

const backfillSuffix = '-cover-backfill.webp'

interface AlbumRow {
  id: string
  title: string
  cover_img_url: string | null
  image_count: number
  backfilled: boolean
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

function parseIds(argv: string[]): string[] {
  const ids: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--id' && argv[i + 1]) ids.push(argv[++i])
  }
  return ids
}

async function main() {
  const apply = process.argv.includes('--apply')
  const ids = parseIds(process.argv)
  const publicUrl = requireEnv('R2_PUBLIC_URL').replace(/\/+$/, '')
  const bucket = requireEnv('R2_BUCKET_NAME')
  const sql = neon(requireEnv('DATABASE_URL'))

  const albums = (await sql`
    SELECT a.id, a.title, a.cover_img_url,
      (SELECT count(*)::int FROM gallery_images i WHERE i.album_id = a.id) AS image_count,
      EXISTS (SELECT 1 FROM gallery_images i WHERE i.album_id = a.id AND i.image_url LIKE ${'%' + backfillSuffix}) AS backfilled
    FROM gallery_albums a
    ORDER BY a.event_date DESC NULLS LAST, a.created_at DESC
  `) as AlbumRow[]

  if (ids.length === 0) {
    for (const a of albums) {
      console.log(`${a.id}  사진 ${a.image_count}장  ${a.backfilled ? '[채움]' : ''}  ${a.title}`)
    }
    console.log('\n대상을 --id <uuid> 로 지정하세요.')
    return
  }

  const targets = ids.map((id) => {
    const album = albums.find((a) => a.id === id)
    if (!album) throw new Error(`앨범 없음: ${id}`)
    return album
  })

  const client = makeR2Client()
  for (const album of targets) {
    if (album.backfilled) {
      console.log(`건너뜀(이미 채움): ${album.title}`)
      continue
    }
    if (!album.cover_img_url?.startsWith(`${publicUrl}/gallery/`)) {
      console.log(`건너뜀(표지 없음): ${album.title}`)
      continue
    }
    const sourceKey = album.cover_img_url.slice(publicUrl.length + 1)
    const targetKey = `gallery/${crypto.randomUUID()}${backfillSuffix}`
    console.log(
      `${apply ? '적용' : 'dry-run'}: ${album.title}\n  ${sourceKey} → ${targetKey}, 사진 ${album.image_count}장 앞에 삽입`,
    )
    if (!apply) continue

    const source = await client.send(new GetObjectCommand({ Bucket: bucket, Key: sourceKey }))
    const body = Buffer.from(await source.Body!.transformToByteArray())
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: targetKey,
        Body: body,
        ContentType: source.ContentType ?? 'image/webp',
      }),
    )
    const imageUrl = `${publicUrl}/${targetKey}`
    await sql.transaction([
      sql`UPDATE gallery_images SET sort_order = sort_order + 1 WHERE album_id = ${album.id}`,
      sql`INSERT INTO gallery_images (album_id, image_url, alt, sort_order) VALUES (${album.id}, ${imageUrl}, ${album.title}, 0)`,
    ])
    console.log(`  완료`)
  }

  if (!apply) console.log('\ndry-run — 실제 반영하려면 --apply 를 붙이세요.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
