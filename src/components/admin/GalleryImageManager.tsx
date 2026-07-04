'use client'

import { FormEvent, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SubmitButton from './SubmitButton'
import { compressImageFile } from '@/lib/client-image-compress'
import { extractVideoPoster, putWithProgress } from '@/lib/client-video-upload'
import { videoUploadProblem } from '@/lib/gallery-video'
import type { GalleryUploadResponse } from '@/app/api/admin/gallery/upload/route'
import type { GalleryImage } from '@/lib/types'

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

export default function GalleryImageManager({
  images,
  saveImageAction,
  saveVideoAction,
  createVideoUploadAction,
  updateImageAction,
  deleteAction,
  reorderAction,
}: GalleryImageManagerProps) {
  const router = useRouter()
  const addFormRef = useRef<HTMLFormElement>(null)
  const videoFormRef = useRef<HTMLFormElement>(null)
  const [orderedImages, setOrderedImages] = useState(images)
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set())
  const [prevImages, setPrevImages] = useState(images)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editAlt, setEditAlt] = useState('')

  if (prevImages !== images) {
    const nextDeletedIds = new Set([...optimisticDeletedIds].filter((id) => images.some((image) => image.id === id)))
    setPrevImages(images)
    setOptimisticDeletedIds(nextDeletedIds)
    setOrderedImages(images.filter((image) => !nextDeletedIds.has(image.id)))
  }

  function moveImage(index: number, offset: number) {
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= orderedImages.length) return
    setOrderedImages((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  // 압축(순차) → R2 업로드(병렬, API Route) → DB 저장(순차 서버 액션) 3단계.
  // 서버 액션은 React가 직렬화하므로 업로드 단계만 fetch로 병렬 처리한다.
  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!addFormRef.current) return
    const formData = new FormData(addFormRef.current)
    const files = formData.getAll('image').filter((value): value is File => value instanceof File && value.size > 0)
    if (files.length === 0) return
    const caption = String(formData.get('caption') ?? '')
    const alt = String(formData.get('alt') ?? '')
    setError('')

    startTransition(async () => {
      try {
        // 1) 클라이언트 압축 — 캔버스는 메인 스레드라 순차로 돌리고 진행률만 표시
        const compressed: File[] = []
        for (const [index, file] of files.entries()) {
          setProgress(`압축 중 (${index + 1}/${files.length})`)
          compressed.push(await compressImageFile(file))
        }

        // 2) R2 병렬 업로드
        let uploadedCount = 0
        setProgress(`업로드 중 (0/${compressed.length})`)
        type UploadResult = { name: string; url: string } | { name: string; url?: never; error: string }
        const results = await Promise.all(
          compressed.map(async (file): Promise<UploadResult> => {
            try {
              const body = new FormData()
              body.append('image', file)
              const res = await fetch('/api/admin/gallery/upload', { method: 'POST', body })
              const data = (await res.json()) as GalleryUploadResponse
              if (!res.ok || !('url' in data)) {
                return { name: file.name, error: 'error' in data ? data.error : '업로드 실패' }
              }
              return { name: file.name, url: data.url }
            } catch {
              return { name: file.name, error: '네트워크 오류' }
            } finally {
              uploadedCount += 1
              setProgress(`업로드 중 (${uploadedCount}/${compressed.length})`)
            }
          })
        )

        // 3) DB 저장 — sortOrder 경합을 피해 순차 실행
        setProgress('저장 중...')
        const failures = results.filter((result): result is { name: string; error: string } => 'error' in result)
        for (const result of results) {
          if (!result.url) continue
          try {
            await saveImageAction(result.url, caption, alt)
          } catch {
            failures.push({ name: result.name, error: '저장 실패' })
          }
        }

        if (failures.length > 0) {
          setError(failures.map((failure) => `${failure.name}: ${failure.error}`).join(' / '))
        } else {
          addFormRef.current?.reset()
        }
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '이미지 추가에 실패했습니다.')
      } finally {
        setProgress('')
      }
    })
  }

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

  function handleDelete(imageId: string) {
    setError('')
    startTransition(async () => {
      try {
        await deleteAction(imageId)
        setOptimisticDeletedIds((current) => new Set(current).add(imageId))
        setOrderedImages((current) => current.filter((image) => image.id !== imageId))
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '이미지 삭제에 실패했습니다.')
      }
    })
  }

  function startEditMeta(imageId: string) {
    const image = orderedImages.find((item) => item.id === imageId)
    if (!image) return
    setEditingId(imageId)
    setEditCaption(image.caption ?? '')
    setEditAlt(image.alt ?? '')
  }

  function handleSaveMeta() {
    if (!editingId) return
    const imageId = editingId
    setError('')
    startTransition(async () => {
      try {
        await updateImageAction(imageId, editCaption, editAlt)
        setOrderedImages((current) =>
          current.map((image) =>
            image.id === imageId ? { ...image, caption: editCaption.trim() || undefined, alt: editAlt.trim() || image.alt } : image
          )
        )
        setEditingId(null)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '캡션 저장에 실패했습니다.')
      }
    })
  }

  function handleSaveOrder() {
    setError('')
    startTransition(async () => {
      try {
        await reorderAction(orderedImages.map((image) => image.id))
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '순서 저장에 실패했습니다.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <form ref={addFormRef} onSubmit={handleAdd} className="space-y-4 rounded-xl bg-paper p-6 shadow-sm">
        <h2 className="text-base font-bold text-ink">사진 추가</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="image" className="mb-2 block text-sm font-medium text-ink">
              이미지 (여러 장 선택 가능)
            </label>
            <input
              id="image"
              name="image"
              type="file"
              accept="image/*"
              multiple
              required
              className="w-full rounded-lg border border-line bg-bg px-4 py-2.5 text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-bg"
            />
          </div>
          <div>
            <label htmlFor="caption" className="mb-2 block text-sm font-medium text-ink">
              캡션
            </label>
            <input
              id="caption"
              name="caption"
              className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="alt" className="mb-2 block text-sm font-medium text-ink">
              대체 텍스트
            </label>
            <input
              id="alt"
              name="alt"
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
            {isPending ? progress || '처리 중...' : '사진 추가'}
          </SubmitButton>
        </div>
      </form>

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

      <div className="rounded-xl bg-paper p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-ink">사진·영상 목록</h2>
          <button
            type="button"
            onClick={handleSaveOrder}
            disabled={isPending || orderedImages.length < 2}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            순서 저장
          </button>
        </div>

        {error ? <p className="mb-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{error}</p> : null}

        {orderedImages.length === 0 ? (
          <p className="rounded-lg border border-line bg-bg px-4 py-6 text-sm text-ink-muted">등록된 사진·영상이 없습니다.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orderedImages.map((image, index) => (
              <figure key={image.id} className="overflow-hidden rounded-lg border border-line bg-bg">
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
                <figcaption className="space-y-3 p-4">
                  {editingId === image.id ? (
                    <div className="space-y-2">
                      <input
                        value={editCaption}
                        onChange={(event) => setEditCaption(event.target.value)}
                        placeholder="캡션"
                        className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none transition focus:border-accent"
                      />
                      <input
                        value={editAlt}
                        onChange={(event) => setEditAlt(event.target.value)}
                        placeholder="대체 텍스트"
                        className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none transition focus:border-accent"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveMeta}
                          disabled={isPending}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={isPending}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="min-h-5 text-sm text-ink-muted">{image.caption || image.alt || '-'}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveImage(index, -1)}
                          disabled={index === 0 || isPending}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          위로
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 1)}
                          disabled={index === orderedImages.length - 1 || isPending}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          아래로
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditMeta(image.id)}
                          disabled={isPending}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(image.id)}
                          disabled={isPending}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
