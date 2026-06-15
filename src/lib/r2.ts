import 'server-only'

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET_NAME
const publicUrl = process.env.R2_PUBLIC_URL

function requireEnv(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${requireEnv(accountId, 'R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv(accessKeyId, 'R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv(secretAccessKey, 'R2_SECRET_ACCESS_KEY'),
  },
})

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
  return `gallery/${crypto.randomUUID()}-${sanitizeR2Filename(filename)}`
}

export function bulletinHwpKey(filename: string) {
  return `bulletins/${crypto.randomUUID()}-${sanitizeR2Filename(filename)}`
}

export async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await r2Client.send(
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
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: requireEnv(bucket, 'R2_BUCKET_NAME'),
      Key: key,
    })
  )
}

export function keyFromUrl(url: string | null | undefined) {
  if (!url) return ''

  const base = normalizedPublicUrl()
  if (url.startsWith(`${base}/`)) return url.slice(base.length + 1)

  try {
    const parsed = new URL(url)
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  } catch {
    return url.replace(/^\/+/, '')
  }
}
