import 'server-only'

import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { isAllowedUploadMime, type UploadMime } from '@/lib/upload-sniff'

// 환경변수에 붙여넣을 때 섞이는 공백/줄바꿈은 SigV4 서명 키를 어긋나게 해
// SignatureDoesNotMatch(403)를 유발한다. 자격증명류는 일괄 trim 한다.
const accountId = process.env.R2_ACCOUNT_ID?.trim()
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
const bucket = process.env.R2_BUCKET_NAME?.trim()
const publicUrl = process.env.R2_PUBLIC_URL?.trim()
const allowedKeyPrefixes = ['bulletins/', 'gallery/', 'thumbnails/'] as const

let r2Client: S3Client | undefined

function requireEnv(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function getR2Client() {
  r2Client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${requireEnv(accountId, 'R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv(accessKeyId, 'R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv(secretAccessKey, 'R2_SECRET_ACCESS_KEY'),
    },
    // Cloudflare R2는 aws-sdk-js v3 기본 CRC32 무결성 체크섬을 제대로 처리하지 못해
    // PUT 시 SignatureDoesNotMatch(403)를 낸다. 자동 체크섬을 꺼서 호환성을 맞춘다.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return r2Client
}

function normalizedPublicUrl() {
  return requireEnv(publicUrl, 'R2_PUBLIC_URL').replace(/\/+$/, '')
}

export function sanitizeR2Filename(filename: string) {
  const fallback = 'image'
  const clean = filename
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return clean || fallback
}

export function galleryImageKey(filename: string) {
  const base = sanitizeR2Filename(filename).replace(/\.[^.]+$/, '') || 'image'
  return `gallery/${crypto.randomUUID()}-${base}.webp`
}

export function galleryVideoKey(filename: string, ext: string) {
  const base = sanitizeR2Filename(filename).replace(/\.[^.]+$/, '') || 'video'
  return `gallery/${crypto.randomUUID()}-${base}.${ext}`
}

export function publicUrlForKey(key: string) {
  return `${normalizedPublicUrl()}/${key}`
}

// 영상은 Vercel 본문 한도(4.5MB) 때문에 서버를 거치지 못한다.
// 브라우저가 R2에 직접 PUT 하도록 서명 URL을 발급한다. Content-Type이 서명에
// 포함되므로 클라이언트가 다른 타입으로 올리면 R2가 403으로 거부한다.
export async function presignGalleryVideoPut(key: string, contentType: string, expiresIn = 600) {
  if (!key.startsWith('gallery/')) throw new Error('invalid key prefix')
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: requireEnv(bucket, 'R2_BUCKET_NAME'),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn, signableHeaders: new Set(['content-type']) }
  )
}

// presigned PUT은 Content-Length를 서명하지 않아 선언 크기와 실제 업로드 크기가
// 다를 수 있다. 업로드 완료 후 addVideoRecord가 이걸로 실물을 검증한다.
export async function headR2Object(key: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const res = await getR2Client().send(
      new HeadObjectCommand({
        Bucket: requireEnv(bucket, 'R2_BUCKET_NAME'),
        Key: key,
      })
    )
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? '' }
  } catch (error) {
    // 404(객체 없음)만 null — 일시 장애를 "없음"으로 오판해 정상 업로드를 버리지 않도록 그 외는 던진다
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
    const name = (error as { name?: string })?.name
    if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') return null
    throw error
  }
}

export function bulletinHwpKey(filename: string) {
  return `bulletins/${crypto.randomUUID()}-${sanitizeR2Filename(filename)}`
}

// sharp가 WASM(@img/sharp-wasm32) 폴백으로 동작하면 출력 버퍼가 SharedArrayBuffer 기반이 되는데,
// aws-sdk SigV4 페이로드 해시가 SAB 를 거부해 업로드가 TypeError 로 죽는다. 일반 버퍼로 복사해 방어한다.
export function toArrayBufferBacked(buffer: Buffer): Buffer {
  return buffer.buffer instanceof SharedArrayBuffer ? Buffer.from(buffer) : buffer
}

export async function uploadToR2(buffer: Buffer, key: string, contentType: UploadMime): Promise<string> {
  if (!isAllowedUploadMime(contentType)) throw new Error('unsupported upload content type')
  const body = toArrayBufferBacked(buffer)
  if (body !== buffer) console.warn(`[r2] SharedArrayBuffer 기반 버퍼 감지 — 복사 후 업로드 key=${key}`)
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: requireEnv(bucket, 'R2_BUCKET_NAME'),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
  return publicUrlForKey(key)
}

export async function deleteFromR2(key: string) {
  if (!key) return
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: requireEnv(bucket, 'R2_BUCKET_NAME'),
      Key: key,
    })
  )
}

export function keyFromUrl(url: string | null | undefined) {
  if (!url) return ''

  const base = normalizedPublicUrl()
  if (!url.startsWith(`${base}/`)) return ''

  const key = url.slice(base.length + 1)
  return allowedKeyPrefixes.some((prefix) => key.startsWith(prefix)) ? key : ''
}
