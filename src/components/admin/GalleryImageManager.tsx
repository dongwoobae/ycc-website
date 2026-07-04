'use client'

import { FormEvent, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SubmitButton from './SubmitButton'
import { compressFormDataImage } from '@/lib/client-image-compress'
import type { GalleryImage } from '@/lib/types'

interface GalleryImageManagerProps {
  images: GalleryImage[]
  addAction: (formData: FormData) => Promise<void>
  deleteAction: (imageId: string) => Promise<void>
  reorderAction: (imageIds: string[]) => Promise<void>
}

export default function GalleryImageManager({
  images,
  addAction,
  deleteAction,
  reorderAction,
}: GalleryImageManagerProps) {
  const router = useRouter()
  const addFormRef = useRef<HTMLFormElement>(null)
  const [orderedImages, setOrderedImages] = useState(images)
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set())
  const [prevImages, setPrevImages] = useState(images)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

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

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!addFormRef.current) return
    setError('')
    const formData = new FormData(addFormRef.current)
    startTransition(async () => {
      try {
        await compressFormDataImage(formData, 'image')
        await addAction(formData)
        addFormRef.current?.reset()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '이미지 추가에 실패했습니다.')
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
              이미지
            </label>
            <input
              id="image"
              name="image"
              type="file"
              accept="image/*"
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
            pendingLabel="처리 중..."
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? '처리 중...' : '사진 추가'}
          </SubmitButton>
        </div>
      </form>

      <div className="rounded-xl bg-paper p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-ink">사진 목록</h2>
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
          <p className="rounded-lg border border-line bg-bg px-4 py-6 text-sm text-ink-muted">등록된 사진이 없습니다.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orderedImages.map((image, index) => (
              <figure key={image.id} className="overflow-hidden rounded-lg border border-line bg-bg">
                <div className="aspect-[4/3] bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.imageUrl} alt={image.alt} className="h-full w-full object-cover" />
                </div>
                <figcaption className="space-y-3 p-4">
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
                      onClick={() => handleDelete(image.id)}
                      disabled={isPending}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      삭제
                    </button>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
