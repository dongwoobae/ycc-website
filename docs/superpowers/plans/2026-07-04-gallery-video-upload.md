# 갤러리 영상 업로드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 갤러리 앨범에 영상(≤200MB)을 R2 presigned URL 직접 업로드로 올리고, 공개 갤러리에서 재생할 수 있게 한다.

**Architecture:** 영상은 Vercel을 거치지 않고 브라우저→R2 직접 PUT(presigned URL). 포스터는 브라우저에서 첫 프레임을 canvas로 추출해 기존 이미지 업로드 API를 재사용. DB는 기존 `gallery_images`에 `media_type`/`poster_url` 컬럼만 추가해 정렬·삭제·순서 로직을 전부 재사용한다.

**Tech Stack:** Next.js 16(App Router, 서버 액션), Drizzle + Neon Postgres, Cloudflare R2(@aws-sdk/client-s3 + s3-request-presigner), vitest, Playwright.

**스펙:** `docs/superpowers/specs/2026-07-04-gallery-video-upload-design.md`

## Global Constraints

- 이 repo의 Next.js 16은 훈련 데이터와 다를 수 있음 — 낯선 API를 쓰기 전 `node_modules/next/dist/docs/`의 해당 가이드를 확인할 것. 이 계획은 기존 코드에 이미 있는 패턴(서버 액션, revalidatePath, next/image)만 사용한다.
- 영상 정책: mp4/quicktime/webm만, 최대 200MB (`maxVideoSize = 200 * 1024 * 1024`).
- R2 키는 반드시 `gallery/` prefix (기존 `keyFromUrl` allowlist에 이미 포함).
- UI 문구는 한국어, 기존 컴포넌트의 Tailwind 클래스 스타일을 그대로 따른다.
- 커밋 메시지는 기존 스타일: `feat:`/`fix:` + 한국어 요약.
- 각 태스크 종료 시 검증: `npm run test`(vitest), `npx tsc --noEmit`. 모든 명령은 `c:/Users/dw581/project/ycc-website`에서 실행.
- 작업 브랜치: `feat/gallery-video-upload` (이미 생성됨).

---

### Task 1: DB 스키마 + 도메인 타입 확장

**Files:**
- Modify: `src/lib/db/schema.ts:133-143` (galleryImages 테이블)
- Modify: `src/lib/types.ts:67-72` (GalleryImage 인터페이스)
- Modify: `src/lib/data/gallery.ts:13, 24-29, 44-51` (컬럼 선택 + 매핑)
- Create: `drizzle/0016_*.sql` (drizzle-kit이 자동 생성)

**Interfaces:**
- Produces: `galleryImages.mediaType`(text, not null, default `'image'`), `galleryImages.posterUrl`(text, nullable). `GalleryImage`에 `mediaType: 'image' | 'video'`, `posterUrl?: string` 필드. 이후 모든 태스크가 이 두 필드에 의존한다.

- [ ] **Step 1: schema.ts에 컬럼 추가**

`src/lib/db/schema.ts`의 `galleryImages` 테이블 정의를 다음으로 교체:

```ts
export const galleryImages = pgTable('gallery_images', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  albumId: uuid('album_id')
    .notNull()
    .references(() => galleryAlbums.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  // 영상도 이 테이블에 함께 저장한다: mediaType='video'면 imageUrl이 영상 URL, posterUrl이 썸네일
  mediaType: text('media_type').notNull().default('image'),
  posterUrl: text('poster_url'),
  caption: text('caption'),
  alt: text('alt'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [index('gallery_images_album_sort_idx').on(t.albumId, t.sortOrder)])
```

- [ ] **Step 2: 마이그레이션 생성**

Run: `npm run db:generate`
Expected: `drizzle/0016_<임의이름>.sql` 생성. 내용에 `ALTER TABLE "gallery_images" ADD COLUMN "media_type" text DEFAULT 'image' NOT NULL;`와 `ADD COLUMN "poster_url" text;`가 포함.

- [ ] **Step 3: types.ts 확장**

`src/lib/types.ts`의 `GalleryImage`를 다음으로 교체:

```ts
export interface GalleryImage {
  id: string
  /** mediaType이 'video'면 영상 파일 URL */
  imageUrl: string
  caption?: string
  alt: string
  mediaType: 'image' | 'video'
  /** 영상 썸네일. 추출 실패 시 없을 수 있다 */
  posterUrl?: string
}
```

- [ ] **Step 4: data/gallery.ts 매핑 확장**

`ImageListRow`, `imageColumns`, `toImage`를 다음으로 교체:

```ts
type ImageListRow = Pick<GalleryImageRow, 'id' | 'imageUrl' | 'caption' | 'alt' | 'mediaType' | 'posterUrl'>
```

```ts
const imageColumns = {
  id: imagesTable.id,
  imageUrl: imagesTable.imageUrl,
  caption: imagesTable.caption,
  alt: imagesTable.alt,
  mediaType: imagesTable.mediaType,
  posterUrl: imagesTable.posterUrl,
}
```

```ts
function toImage(row: ImageListRow): GalleryImage {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    caption: row.caption ?? undefined,
    alt: row.alt ?? '',
    mediaType: row.mediaType === 'video' ? 'video' : 'image',
    posterUrl: row.posterUrl ?? undefined,
  }
}
```

- [ ] **Step 5: 타입 체크 + 기존 테스트 확인**

Run: `npx tsc --noEmit && npm run test`
Expected: 둘 다 통과. (GalleryImage를 만드는 곳은 `toImage` 하나뿐이므로 다른 컴파일 에러가 나면 그 지점도 mediaType을 채워야 한다 — `'image'` 리터럴로.)

- [ ] **Step 6: DB 적용**

Run: `npm run db:migrate`
Expected: 0016 마이그레이션 적용 로그. (Neon 원격 DB에 컬럼 추가 — 기본값이 있어 기존 행·기존 코드에 무해.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts src/lib/types.ts src/lib/data/gallery.ts drizzle/
git commit -m "feat: gallery_images에 media_type·poster_url 컬럼 추가 (영상 지원 준비)"
```

---

### Task 2: 영상 업로드 정책 헬퍼 (클라이언트·서버 공유)

**Files:**
- Create: `src/lib/gallery-video.ts`
- Test: `src/lib/gallery-video.test.ts`

**Interfaces:**
- Produces: `maxVideoSize: number`, `videoExtByMime: Record<AllowedVideoMime, string>`, `isAllowedVideoMime(t: string): t is AllowedVideoMime`, `videoUploadProblem(contentType: string, size: number): string | null` (문제 없으면 null, 있으면 한국어 에러 메시지). `'server-only'` import 없음 — 클라이언트 폼과 서버 액션이 함께 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/gallery-video.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isAllowedVideoMime, maxVideoSize, videoUploadProblem } from './gallery-video'

describe('isAllowedVideoMime', () => {
  it('mp4·quicktime·webm만 허용한다', () => {
    expect(isAllowedVideoMime('video/mp4')).toBe(true)
    expect(isAllowedVideoMime('video/quicktime')).toBe(true)
    expect(isAllowedVideoMime('video/webm')).toBe(true)
    expect(isAllowedVideoMime('video/x-msvideo')).toBe(false)
    expect(isAllowedVideoMime('image/png')).toBe(false)
    expect(isAllowedVideoMime('')).toBe(false)
  })
})

describe('videoUploadProblem', () => {
  it('정상 입력이면 null', () => {
    expect(videoUploadProblem('video/mp4', 10 * 1024 * 1024)).toBeNull()
  })
  it('허용 외 형식이면 메시지', () => {
    expect(videoUploadProblem('video/avi', 1024)).toContain('지원하지 않는 영상 형식')
  })
  it('200MB 초과면 메시지', () => {
    expect(videoUploadProblem('video/mp4', maxVideoSize + 1)).toContain('200MB')
  })
  it('0 이하·비정상 크기면 메시지', () => {
    expect(videoUploadProblem('video/mp4', 0)).not.toBeNull()
    expect(videoUploadProblem('video/mp4', Number.NaN)).not.toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/gallery-video.test.ts`
Expected: FAIL — `Cannot find module './gallery-video'` 계열 에러.

- [ ] **Step 3: 구현**

`src/lib/gallery-video.ts`:

```ts
// 영상 업로드 정책 — 관리자 폼(클라이언트)과 presign 서버 액션이 공유한다.
// 'server-only' 금지: 클라이언트 번들에 포함된다.
export const maxVideoSize = 200 * 1024 * 1024

export const videoExtByMime = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
} as const

export type AllowedVideoMime = keyof typeof videoExtByMime

export function isAllowedVideoMime(contentType: string): contentType is AllowedVideoMime {
  return contentType in videoExtByMime
}

export function videoUploadProblem(contentType: string, size: number): string | null {
  if (!isAllowedVideoMime(contentType)) {
    return '지원하지 않는 영상 형식입니다. mp4(H.264)를 권장합니다.'
  }
  if (!Number.isFinite(size) || size <= 0) return '잘못된 영상 파일입니다.'
  if (size > maxVideoSize) return '영상은 200MB 이하만 업로드할 수 있습니다.'
  return null
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/gallery-video.test.ts`
Expected: PASS (테스트 6개).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-video.ts src/lib/gallery-video.test.ts
git commit -m "feat: 갤러리 영상 업로드 정책 헬퍼 (형식·크기 검증)"
```

---

### Task 3: R2 presign 유틸 + 영상 키 생성

**Files:**
- Modify: `src/lib/r2.ts`
- Test: `src/lib/r2.test.ts` (기존 파일에 describe 추가)
- Modify: `package.json` (의존성 추가)

**Interfaces:**
- Consumes: 기존 `sanitizeR2Filename`, `getR2Client`(내부), `normalizedPublicUrl`(내부).
- Produces: `galleryVideoKey(filename: string, ext: string): string` (`gallery/<uuid>-<base>.<ext>`), `publicUrlForKey(key: string): string`, `presignGalleryVideoPut(key: string, contentType: string, expiresIn?: number): Promise<string>`.

- [ ] **Step 1: 의존성 설치**

Run: `npm install @aws-sdk/s3-request-presigner`
Expected: package.json dependencies에 추가. (기존 `@aws-sdk/client-s3`와 동일 v3 계열.)

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/r2.test.ts` 맨 아래에 추가 (기존 describe들의 동적 import 패턴을 따른다):

```ts
describe('galleryVideoKey / publicUrlForKey', () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets/'
  })

  it('gallery/ prefix + uuid + 정제된 이름 + 확장자로 키를 만든다', async () => {
    const { galleryVideoKey } = await import('./r2')
    const key = galleryVideoKey('내 영상 (1).MOV', 'mov')
    expect(key).toMatch(/^gallery\/[0-9a-f-]{36}-[\w.\-]+\.mov$/)
    expect(key.endsWith('.mov')).toBe(true)
  })

  it('원본 확장자는 버리고 전달받은 ext를 쓴다', async () => {
    const { galleryVideoKey } = await import('./r2')
    expect(galleryVideoKey('clip.webm', 'mp4')).toMatch(/\.mp4$/)
  })

  it('publicUrlForKey는 공개 URL을 조립한다', async () => {
    const { publicUrlForKey } = await import('./r2')
    expect(publicUrlForKey('gallery/abc.mp4')).toBe('https://cdn.example.com/assets/gallery/abc.mp4')
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/r2.test.ts`
Expected: 새 테스트 3개 FAIL (`galleryVideoKey is not a function` 계열), 기존 테스트는 PASS 유지.

- [ ] **Step 4: r2.ts 구현**

`src/lib/r2.ts` 상단 import에 추가:

```ts
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
```

`galleryImageKey` 함수 아래에 추가:

```ts
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
    { expiresIn }
  )
}
```

그리고 `uploadToR2`의 마지막 줄 `return \`${normalizedPublicUrl()}/${key}\``를 `return publicUrlForKey(key)`로 교체 (DRY).

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/r2.test.ts && npx tsc --noEmit`
Expected: 전부 PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/r2.ts src/lib/r2.test.ts
git commit -m "feat: R2 영상 키 생성·presigned PUT URL 발급 유틸"
```

---

### Task 4: 서버 액션 — presign 발급·영상 레코드 저장·삭제 확장

**Files:**
- Modify: `src/lib/actions/gallery.ts`

**Interfaces:**
- Consumes: Task 2의 `videoExtByMime`, `videoUploadProblem`; Task 3의 `galleryVideoKey`, `presignGalleryVideoPut`, `publicUrlForKey`; Task 1의 `mediaType`/`posterUrl` 컬럼.
- Produces (Task 6의 클라이언트가 호출):
  - `createVideoUploadUrl(fileName: string, contentType: string, size: number): Promise<{ uploadUrl: string; publicUrl: string }>`
  - `addVideoRecord(albumId: string, videoUrl: string, posterUrl: string, caption: string, alt: string): Promise<void>` (posterUrl은 빈 문자열 허용 = 포스터 없음)
  - 기존 `deleteImage`/`deleteAlbum`이 영상 포스터 R2 파일까지 삭제.

- [ ] **Step 1: import 추가**

`src/lib/actions/gallery.ts` 상단에:

```ts
import { videoExtByMime, videoUploadProblem, type AllowedVideoMime } from '@/lib/gallery-video'
```

그리고 기존 r2 import 줄을 다음으로 교체:

```ts
import { deleteFromR2, galleryVideoKey, keyFromUrl, presignGalleryVideoPut, publicUrlForKey } from '@/lib/r2'
```

(`deleteFromR2`는 기존 `deleteR2BestEffort`가 사용 — 유지.)

- [ ] **Step 2: createVideoUploadUrl 액션 추가**

`addImageRecord` 함수 위에 추가:

```ts
// 영상은 브라우저가 R2로 직접 PUT 한다(Vercel 4.5MB 본문 한도 우회).
// 여기서는 검증 + 서명 URL 발급만 하고, DB 저장은 addVideoRecord가 담당.
export async function createVideoUploadUrl(fileName: string, contentType: string, size: number) {
  await requireSession()
  const problem = videoUploadProblem(contentType, size)
  if (problem) throw new Error(problem)
  const key = galleryVideoKey(fileName, videoExtByMime[contentType as AllowedVideoMime])
  const uploadUrl = await presignGalleryVideoPut(key, contentType)
  return { uploadUrl, publicUrl: publicUrlForKey(key) }
}
```

- [ ] **Step 3: addVideoRecord 액션 추가**

`addImageRecord` 함수 아래에 추가:

```ts
export async function addVideoRecord(albumId: string, videoUrl: string, posterUrl: string, caption: string, alt: string) {
  const s = await requireSession()
  if (!keyFromUrl(videoUrl).startsWith('gallery/')) throw new Error('invalid video url')
  if (posterUrl && !keyFromUrl(posterUrl).startsWith('gallery/')) throw new Error('invalid poster url')

  const cleanupR2 = async () => {
    await deleteR2BestEffort(keyFromUrl(videoUrl), s.user.id)
    if (posterUrl) await deleteR2BestEffort(keyFromUrl(posterUrl), s.user.id)
  }

  const [album] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, albumId)).limit(1)
  if (!album) {
    await cleanupR2()
    throw new Error('album not found')
  }

  const [lastImage] = await db
    .select({ sortOrder: galleryImages.sortOrder })
    .from(galleryImages)
    .where(eq(galleryImages.albumId, albumId))
    .orderBy(desc(galleryImages.sortOrder))
    .limit(1)

  let created: { id: string } | undefined
  try {
    const result = await db
      .insert(galleryImages)
      .values({
        albumId,
        imageUrl: videoUrl,
        mediaType: 'video',
        posterUrl: posterUrl || null,
        caption: caption.trim() || null,
        alt: alt.trim() || album.title,
        sortOrder: (lastImage?.sortOrder ?? -1) + 1,
      })
      .returning({ id: galleryImages.id })
    created = result[0]
  } catch (e) {
    await cleanupR2()
    throw e
  }

  if (!created) throw new Error('failed to add video')
  await log('create', 'gallery_image', created.id, `${album.title} (영상)`, s.user.id)
  revalidateGalleryPaths(albumId)
}
```

- [ ] **Step 4: 삭제 경로에 포스터 정리 추가**

`deleteImage`에서 `await deleteR2BestEffort(keyFromUrl(image.imageUrl), s.user.id)` 바로 아래에 추가:

```ts
  if (image.posterUrl) await deleteR2BestEffort(keyFromUrl(image.posterUrl), s.user.id)
```

`deleteAlbum`의 keys 계산을 다음으로 교체 (영상 포스터 포함):

```ts
  const keys = [album.coverImgUrl, ...images.flatMap((image) => [image.imageUrl, image.posterUrl])]
    .map(keyFromUrl)
    .filter(Boolean)
```

- [ ] **Step 5: 검증**

Run: `npx tsc --noEmit && npm run test`
Expected: 통과. (액션은 DB·세션 의존이라 단위 테스트 없음 — 검증 로직은 Task 2에서 이미 테스트됨. e2e는 Task 7.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/gallery.ts
git commit -m "feat: 영상 presign 발급·레코드 저장 액션, 삭제 시 포스터 정리"
```

---

### Task 5: 클라이언트 영상 업로드 유틸 (XHR 진행률 + 포스터 추출)

**Files:**
- Create: `src/lib/client-video-upload.ts`

**Interfaces:**
- Produces (Task 6이 사용):
  - `putWithProgress(url: string, file: File, onProgress: (percent: number) => void): Promise<void>`
  - `extractVideoPoster(file: File): Promise<Blob | null>` — 실패(코덱 미지원 등) 시 null, 절대 reject하지 않음.
- 브라우저 API(XHR, video, canvas) 의존이라 단위 테스트 없음. e2e(Task 7)와 수동 검증으로 커버.

- [ ] **Step 1: 구현**

`src/lib/client-video-upload.ts`:

```ts
// 브라우저 → R2 직접 업로드 도우미. fetch는 업로드 진행률 이벤트가 없어 XHR 사용.

export function putWithProgress(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    // presign 서명에 Content-Type이 포함되므로 반드시 동일 값으로 보낸다
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`영상 업로드 실패 (HTTP ${xhr.status})`))
    xhr.onerror = () => reject(new Error('영상 업로드 실패 — 네트워크 또는 R2 CORS 설정을 확인하세요.'))
    xhr.send(file)
  })
}

// 첫 프레임(0.1초 지점)을 JPEG로 캡처한다. 브라우저가 코덱을 못 읽으면 null —
// 호출부는 포스터 없이 저장하고 표시 측이 플레이스홀더를 쓴다.
export function extractVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let settled = false

    const finish = (blob: Blob | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      resolve(blob)
    }

    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onerror = () => finish(null)
    video.onloadeddata = () => {
      // 0초 프레임이 빈 화면인 기기가 있어 살짝 시킹한다
      video.currentTime = Math.min(0.1, video.duration || 0.1)
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      if (!canvas.width || !canvas.height) return finish(null)
      const ctx = canvas.getContext('2d')
      if (!ctx) return finish(null)
      ctx.drawImage(video, 0, 0)
      canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.85)
    }
    // 메타데이터/시킹 이벤트가 영영 안 오는 경우 대비
    setTimeout(() => finish(null), 10_000)
    video.src = url
  })
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/lib/client-video-upload.ts
git commit -m "feat: 클라이언트 영상 직접 업로드·포스터 추출 유틸"
```

---

### Task 6: 관리자 UI — "영상 추가" 카드 + 목록 영상 표시 + 페이지 배선

**Files:**
- Modify: `src/components/admin/GalleryImageManager.tsx`
- Modify: `src/app/admin/gallery/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: Task 4의 `createVideoUploadUrl`, `addVideoRecord`; Task 5의 `putWithProgress`, `extractVideoPoster`; Task 2의 `videoUploadProblem`; Task 1의 `GalleryImage.mediaType`/`posterUrl`.
- Produces: `GalleryImageManagerProps`에 두 prop 추가 — `saveVideoAction: (videoUrl: string, posterUrl: string, caption: string, alt: string) => Promise<void>`, `createVideoUploadAction: (fileName: string, contentType: string, size: number) => Promise<{ uploadUrl: string; publicUrl: string }>`.

- [ ] **Step 1: GalleryImageManager에 import·prop 추가**

상단 import에 추가:

```ts
import { extractVideoPoster, putWithProgress } from '@/lib/client-video-upload'
import { videoUploadProblem } from '@/lib/gallery-video'
```

`GalleryImageManagerProps`를 다음으로 교체:

```ts
interface GalleryImageManagerProps {
  images: GalleryImage[]
  saveImageAction: (imageUrl: string, caption: string, alt: string) => Promise<void>
  saveVideoAction: (videoUrl: string, posterUrl: string, caption: string, alt: string) => Promise<void>
  createVideoUploadAction: (
    fileName: string,
    contentType: string,
    size: number
  ) => Promise<{ uploadUrl: string; publicUrl: string }>
  updateImageAction: (imageId: string, caption: string, alt: string) => Promise<void>
  deleteAction: (imageId: string) => Promise<void>
  reorderAction: (imageIds: string[]) => Promise<void>
}
```

컴포넌트 시그니처의 구조 분해에도 `saveVideoAction, createVideoUploadAction` 추가. 그리고 `addFormRef` 아래에 추가:

```ts
  const videoFormRef = useRef<HTMLFormElement>(null)
```

- [ ] **Step 2: handleAddVideo 구현**

`handleAdd` 함수 아래에 추가:

```ts
  // 영상: presign 발급 → R2 직접 PUT(진행률) → 포스터 추출·업로드 → DB 저장
  function handleAddVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!videoFormRef.current) return
    const formData = new FormData(videoFormRef.current)
    const file = formData.get('video')
    if (!(file instanceof File) || file.size === 0) return
    const caption = String(formData.get('videoCaption') ?? '')
    const alt = String(formData.get('videoAlt') ?? '')
    setError('')

    const problem = videoUploadProblem(file.type, file.size)
    if (problem) {
      setError(problem)
      return
    }

    startTransition(async () => {
      try {
        setProgress('업로드 준비 중...')
        const { uploadUrl, publicUrl } = await createVideoUploadAction(file.name, file.type, file.size)

        await putWithProgress(uploadUrl, file, (percent) => setProgress(`영상 업로드 중 ${percent}%`))

        setProgress('썸네일 생성 중...')
        let posterUrl = ''
        const poster = await extractVideoPoster(file)
        if (poster) {
          const body = new FormData()
          body.append('image', new File([poster], 'poster.jpg', { type: 'image/jpeg' }))
          const res = await fetch('/api/admin/gallery/upload', { method: 'POST', body })
          const data = (await res.json()) as GalleryUploadResponse
          if (res.ok && 'url' in data) posterUrl = data.url
          // 포스터 실패는 치명적이지 않다 — 포스터 없이 저장
        }

        setProgress('저장 중...')
        await saveVideoAction(publicUrl, posterUrl, caption, alt)
        videoFormRef.current?.reset()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '영상 추가에 실패했습니다.')
      } finally {
        setProgress('')
      }
    })
  }
```

- [ ] **Step 3: "영상 추가" 폼 카드 렌더링**

기존 "사진 추가" `</form>` 닫는 태그 바로 다음에 추가 (같은 카드 스타일):

```tsx
      <form ref={videoFormRef} onSubmit={handleAddVideo} className="space-y-4 rounded-xl bg-paper p-6 shadow-sm">
        <h2 className="text-base font-bold text-ink">영상 추가</h2>
        <p className="text-sm text-ink-muted">
          mp4(H.264) 권장 — iPhone 원본(.mov, HEVC)은 일부 기기에서 재생되지 않을 수 있습니다. 최대 200MB.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="video" className="mb-2 block text-sm font-medium text-ink">
              영상 파일
            </label>
            <input
              id="video"
              name="video"
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              required
              className="w-full rounded-lg border border-line bg-bg px-4 py-2.5 text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-bg"
            />
          </div>
          <div>
            <label htmlFor="videoCaption" className="mb-2 block text-sm font-medium text-ink">
              캡션
            </label>
            <input
              id="videoCaption"
              name="videoCaption"
              className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="videoAlt" className="mb-2 block text-sm font-medium text-ink">
              대체 텍스트
            </label>
            <input
              id="videoAlt"
              name="videoAlt"
              className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <SubmitButton
            pendingOverride={isPending}
            pendingLabel={progress || '처리 중...'}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? progress || '처리 중...' : '영상 추가'}
          </SubmitButton>
        </div>
      </form>
```

- [ ] **Step 4: 목록에서 영상 항목 표시**

목록 카드의 썸네일 부분(`<div className="aspect-[4/3] bg-surface">...</div>`)을 다음으로 교체:

```tsx
                <div className="relative aspect-[4/3] bg-surface">
                  {image.mediaType === 'video' && !image.posterUrl ? (
                    <div className="flex h-full w-full items-center justify-center text-sm text-ink-muted">영상</div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.mediaType === 'video' ? image.posterUrl : image.imageUrl}
                      alt={image.alt}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {image.mediaType === 'video' && (
                    <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                      ▶ 영상
                    </span>
                  )}
                </div>
```

또한 카드 제목("사진 추가" 카드 위 문구는 그대로) — 목록 헤딩 `사진 목록`은 `사진·영상 목록`으로, 빈 상태 문구는 `등록된 사진·영상이 없습니다.`로 교체.

- [ ] **Step 5: edit 페이지 배선**

`src/app/admin/gallery/[id]/edit/page.tsx`의 액션 import를 다음으로 교체:

```ts
import {
  addImageRecord,
  addVideoRecord,
  createVideoUploadUrl,
  deleteImage,
  reorderImages,
  updateAlbum,
  updateImageMeta,
} from '@/lib/actions/gallery'
```

`<GalleryImageManager>` 호출을 다음으로 교체:

```tsx
        <GalleryImageManager
          images={album.images}
          saveImageAction={addImageRecord.bind(null, id)}
          saveVideoAction={addVideoRecord.bind(null, id)}
          createVideoUploadAction={createVideoUploadUrl}
          updateImageAction={updateImageMeta}
          deleteAction={deleteImage}
          reorderAction={reorderImages.bind(null, id)}
        />
```

- [ ] **Step 6: 검증**

Run: `npx tsc --noEmit && npm run lint`
Expected: 통과.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/GalleryImageManager.tsx "src/app/admin/gallery/[id]/edit/page.tsx"
git commit -m "feat: 관리자 갤러리에 영상 추가 카드·영상 목록 표시"
```

---

### Task 7: 공개 갤러리 — 그리드 포스터·재생 아이콘 + 라이트박스 재생

**Files:**
- Modify: `src/components/gallery/GalleryGrid.tsx`

**Interfaces:**
- Consumes: `GalleryImage.mediaType`/`posterUrl` (Task 1).
- Produces: 없음 (말단 UI).

- [ ] **Step 1: 재생 아이콘 추가**

`IconChevron` 아래에 추가:

```tsx
function IconPlay() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14Z" />
    </svg>
  )
}
```

- [ ] **Step 2: 그리드 타일 — 영상은 포스터 + 재생 오버레이**

타일의 `<div className="relative aspect-[4/3] bg-surface">` 내부를 다음으로 교체:

```tsx
            <div className="relative aspect-[4/3] bg-surface">
              {image.mediaType === 'video' && !image.posterUrl ? (
                <div className="h-full w-full bg-ink/80" />
              ) : (
                <Image
                  src={image.mediaType === 'video' ? image.posterUrl! : image.imageUrl}
                  alt={image.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              )}
              {image.mediaType === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white transition group-hover:bg-black/70">
                    <IconPlay />
                  </span>
                </span>
              )}
            </div>
```

- [ ] **Step 3: 라이트박스 스테이지 — 영상 재생**

스테이지의 `<Image key={current.imageUrl} ... />` 부분을 다음으로 교체:

```tsx
              {current.mediaType === 'video' ? (
                <video
                  key={current.id}
                  src={current.imageUrl}
                  controls
                  playsInline
                  preload="metadata"
                  poster={current.posterUrl || undefined}
                  className="h-full w-full rounded-lg object-contain"
                />
              ) : (
                <Image
                  key={current.imageUrl}
                  src={current.imageUrl}
                  alt={current.caption ?? current.alt}
                  fill
                  className="rounded-lg object-contain"
                  sizes="(min-width: 900px) 900px, 85vw"
                  priority
                />
              )}
```

(`key={current.id}`라 이전/다음 이동·닫기 시 video 요소가 언마운트되어 재생이 자동 정지된다.)

- [ ] **Step 4: 썸네일 스트립 — 포스터 또는 플레이스홀더**

스트립의 `<Image ... unoptimized />`를 다음으로 교체:

```tsx
                  {image.mediaType === 'video' && !image.posterUrl ? (
                    <span className="flex h-full w-full items-center justify-center bg-ink text-[10px] text-white">▶</span>
                  ) : (
                    <Image
                      src={image.mediaType === 'video' ? image.posterUrl! : image.imageUrl}
                      alt=""
                      width={120}
                      height={88}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  )}
```

또한 라이트박스 `aria-label`을 `` `${albumTitle} 사진·영상 확대 보기` ``로 교체.

- [ ] **Step 5: 검증**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 전부 통과 (build는 이 태스크에서 1회만).

- [ ] **Step 6: Commit**

```bash
git add src/components/gallery/GalleryGrid.tsx
git commit -m "feat: 공개 갤러리 영상 표시 — 포스터 그리드·라이트박스 재생"
```

---

### Task 8: e2e 스모크 + R2 CORS 운영 문서

**Files:**
- Create: `e2e/gallery-video.spec.ts`
- Create: `docs/r2-cors-video-upload.md`

**Interfaces:**
- Consumes: Task 6의 관리자 UI(`#video` input, "영상 추가" 버튼, 에러 문구), Task 2의 에러 메시지 텍스트.

- [ ] **Step 1: e2e 스펙 작성**

`e2e/gallery-video.spec.ts` (기존 `gallery-upload.spec.ts`의 signIn/앨범 헬퍼 패턴을 따른다; 실제 R2 업로드는 CORS 의존이라 여기선 폼 렌더·클라이언트 검증까지만):

```ts
// 갤러리 영상 추가 폼 e2e — 렌더링과 클라이언트 검증까지 확인한다.
// 실제 R2 직접 업로드는 버킷 CORS 설정(docs/r2-cors-video-upload.md)에 의존하므로
// 배포 환경에서 수동 검증한다.
import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'

const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

async function makeCoverJpeg() {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 40, g: 200, b: 40 } } })
    .jpeg({ quality: 80 })
    .toBuffer()
}

async function signIn(page: Page) {
  await page.goto('/sign-in')
  await page.fill('#email', email!)
  await page.fill('#password', password!)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL('**/admin')
}

async function deleteAlbum(page: Page, title: string) {
  if (!page.url().endsWith('/admin/gallery')) await page.goto('/admin/gallery')
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('row').filter({ hasText: title }).getByRole('button', { name: '삭제' }).click()
  await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0, { timeout: 30_000 })
}

test('영상 추가 폼이 렌더되고 허용 외 형식은 클라이언트에서 거부한다', async ({ page }) => {
  test.skip(!email || !password, '.env.local에 E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD가 필요합니다')

  await signIn(page)

  const title = `e2e-영상폼-${Date.now()}`
  await page.goto('/admin/gallery/new')
  await page.fill('#title', title)
  await page.getByLabel('공개').uncheck()
  await page.setInputFiles('#cover', { name: 'cover.jpg', mimeType: 'image/jpeg', buffer: await makeCoverJpeg() })
  await page.getByRole('button', { name: '앨범 작성' }).click()
  await page.waitForURL('**/admin/gallery', { timeout: 60_000 })

  try {
    await page.getByRole('row').filter({ hasText: title }).getByRole('link', { name: '수정' }).click()
    await page.waitForURL('**/admin/gallery/**/edit')

    // 폼 렌더 확인
    await expect(page.getByRole('heading', { name: '영상 추가' })).toBeVisible()
    await expect(page.locator('#video')).toHaveAttribute('accept', 'video/mp4,video/quicktime,video/webm')

    // 허용 외 형식 → presign 요청 없이 클라이언트에서 에러 표시
    await page.setInputFiles('#video', {
      name: 'not-a-video.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    })
    await page.getByRole('button', { name: '영상 추가' }).click()
    await expect(page.getByText('지원하지 않는 영상 형식입니다', { exact: false })).toBeVisible()
  } finally {
    await deleteAlbum(page, title)
  }
})
```

- [ ] **Step 2: e2e 실행**

Run: `npx playwright test e2e/gallery-video.spec.ts`
Expected: `.env.local`에 E2E 계정이 있으면 PASS, 없으면 SKIP. (dev 서버 자동 기동은 기존 playwright.config.ts를 따른다.)

- [ ] **Step 3: R2 CORS 운영 문서 작성**

`docs/r2-cors-video-upload.md`:

```markdown
# R2 CORS 설정 — 갤러리 영상 직접 업로드 (배포 전 1회)

영상은 브라우저가 R2 버킷에 presigned URL로 직접 PUT 한다.
브라우저 cross-origin 요청이므로 버킷에 CORS 정책이 없으면 업로드가 전부 실패한다.

## 설정 방법

Cloudflare 대시보드 → R2 → 해당 버킷 → Settings → CORS Policy → Edit:

​```json
[
  {
    "AllowedOrigins": [
      "https://www.ycjc.kr",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
​```

- Vercel 프리뷰 배포에서도 테스트하려면 `"https://*.vercel.app"`를 AllowedOrigins에 추가
  (와일드카드가 안 먹으면 해당 프리뷰 도메인을 정확히 추가).
- GET은 불필요 — 영상 재생은 R2 공개 URL(R2_PUBLIC_URL) 단순 요청이라 CORS 대상이 아니다.
- 설정 후 확인: 관리자 → 갤러리 앨범 수정 → 영상 추가로 mp4 업로드가 100%까지 진행되면 성공.
  실패 시 브라우저 콘솔에 CORS 에러가 찍힌다.
```

(위 json 코드펜스의 zero-width 문자는 실제 파일에는 넣지 말 것 — 일반 ``` 사용.)

- [ ] **Step 4: 최종 전체 검증**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: 전부 통과.

- [ ] **Step 5: Commit**

```bash
git add e2e/gallery-video.spec.ts docs/r2-cors-video-upload.md
git commit -m "test: 갤러리 영상 폼 e2e 스모크 + R2 CORS 운영 문서"
```

---

## 수동 검증 체크리스트 (배포 후)

1. R2 버킷 CORS 설정 (`docs/r2-cors-video-upload.md`)
2. 관리자에서 mp4 클립 업로드 → 진행률 % 표시 → 목록에 "▶ 영상" 배지 + 포스터 확인
3. 공개 갤러리에서 포스터 + 재생 아이콘 → 라이트박스 재생 확인 (데스크톱 + 모바일 Safari/Chrome)
4. 영상 삭제 → R2에서 영상·포스터 객체 제거 확인
5. iPhone .mov(HEVC) 업로드 시 안드로이드 크롬에서 재생 여부 확인 (안 되면 mp4 변환 안내가 폼에 이미 있음)
```
