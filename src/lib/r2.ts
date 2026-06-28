import 'server-only'

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { isAllowedUploadMime, type UploadMime } from '@/lib/upload-sniff'

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET_NAME
const publicUrl = process.env.R2_PUBLIC_URL
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

export function bulletinHwpKey(filename: string) {
  return `bulletins/${crypto.randomUUID()}-${sanitizeR2Filename(filename)}`
}

export async function uploadToR2(buffer: Buffer, key: string, contentType: UploadMime): Promise<string> {
  if (!isAllowedUploadMime(contentType)) throw new Error('unsupported upload content type')
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: requireEnv(bucket, 'R2_BUCKET_NAME'),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )
  return `${normalizedPublicUrl()}/${key}`
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
