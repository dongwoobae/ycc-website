'use client'

import { FormEvent, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SubmitButton from './SubmitButton'
import { uploadGalleryImages, type GalleryUploadFailure } from '@/lib/client-gallery-upload'
import { compressFormDataImage } from '@/lib/client-image-compress'

export interface AlbumFormInitialValue {
  title: string
  description: string
  eventDate: string
  isPublished: boolean
}

interface AlbumFormProps {
  initialValue?: AlbumFormInitialValue
  submitLabel: string
  /** 새 앨범이면 생성된 앨범 id를 돌려준다. 수정이면 반환값이 없다. */
  submitAction: (formData: FormData) => Promise<string | void>
  /** 수정 모드 앨범 id. 없으면 새 앨범 모드로, 사진 다중 선택 입력이 열린다. */
  albumId?: string
  addImageAction: (albumId: string, imageUrl: string, caption: string, alt: string) => Promise<void>
}

const emptyAlbum: AlbumFormInitialValue = {
  title: '',
  description: '',
  eventDate: new Date().toISOString().slice(0, 10),
  isPublished: true,
}

const fileInputClass =
  'w-full rounded-lg border border-line bg-bg px-4 py-2.5 text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-bg'

function fileOf(formData: FormData, name: string) {
  const value = formData.get(name)
  return value instanceof File && value.size > 0 ? value : null
}

function failureMessage(failures: GalleryUploadFailure[]) {
  return failures.map((failure) => `${failure.name}: ${failure.error}`).join(' / ')
}

export default function AlbumForm({
  initialValue,
  submitLabel,
  submitAction,
  albumId,
  addImageAction,
}: AlbumFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  // 앨범은 만들어졌는데 사진 일부가 실패한 상태. 재제출로 앨범이 중복 생성되지 않게 폼을 잠근다.
  const [createdWithFailures, setCreatedWithFailures] = useState<string | null>(null)
  const [form, setForm] = useState<AlbumFormInitialValue>(initialValue ?? emptyAlbum)
  const isNew = !albumId

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formRef.current || createdWithFailures) return
    setError('')
    const formData = new FormData(formRef.current)
    const photos = formData.getAll('photos').filter((value): value is File => value instanceof File && value.size > 0)
    formData.delete('photos')
    const cover = fileOf(formData, 'cover')

    if (isNew && !cover && photos.length === 0) {
      setError('표지 이미지 또는 사진을 한 장 이상 선택해 주세요.')
      return
    }
    // 표지는 앨범 첫 사진이기도 하다. 표지를 따로 고르지 않았으면 첫 사진이 표지가 된다.
    // 표지용과 사진용은 별도 R2 객체로 올린다 — 한쪽 삭제가 다른 쪽을 지우지 않게.
    if (isNew && !cover) formData.set('cover', photos[0])
    const imageFiles = isNew ? (cover ? [cover, ...photos] : photos) : cover ? [cover] : []

    startTransition(async () => {
      try {
        setProgress('앨범 저장 중...')
        await compressFormDataImage(formData, 'cover')
        const targetAlbumId = albumId ?? (await submitAction(formData))
        if (!targetAlbumId) throw new Error('앨범 저장에 실패했습니다.')

        const failures = await uploadGalleryImages(
          imageFiles,
          (url) => addImageAction(targetAlbumId, url, '', ''),
          setProgress,
        )
        if (failures.length > 0) {
          setError(`앨범은 저장됐지만 일부 사진 등록에 실패했습니다. ${failureMessage(failures)}`)
          if (isNew) setCreatedWithFailures(targetAlbumId)
          router.refresh()
          return
        }
        router.push(isNew ? `/admin/gallery/${targetAlbumId}/edit` : '/admin/gallery')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      } finally {
        setProgress('')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 rounded-xl bg-paper p-6 shadow-sm">
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-medium text-ink">
          앨범명
        </label>
        <input
          id="title"
          name="title"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-2 block text-sm font-medium text-ink">
          설명
        </label>
        <textarea
          id="description"
          name="description"
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          className="min-h-32 w-full resize-y rounded-lg border border-line bg-bg px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-accent"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="eventDate" className="mb-2 block text-sm font-medium text-ink">
            행사일
          </label>
          <input
            id="eventDate"
            name="eventDate"
            type="date"
            value={form.eventDate}
            onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))}
            className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="cover" className="mb-2 block text-sm font-medium text-ink">
            표지 이미지
          </label>
          <input id="cover" name="cover" type="file" accept="image/*" className={fileInputClass} />
          <p className="mt-2 text-xs text-ink-muted">
            {isNew
              ? '표지 생략 시 첫 사진이 사용됩니다. 표지는 앨범 사진에도 포함됩니다.'
              : '교체한 표지는 앨범 사진에도 추가됩니다.'}
          </p>
        </div>
      </div>

      {isNew ? (
        <div>
          <label htmlFor="photos" className="mb-2 block text-sm font-medium text-ink">
            사진 (여러 장 선택 가능)
          </label>
          <input id="photos" name="photos" type="file" accept="image/*" multiple className={fileInputClass} />
          <p className="mt-2 text-xs text-ink-muted">
            앨범을 만든 뒤 수정 화면에서 사진과 영상을 더 추가할 수 있습니다.
          </p>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          name="isPublished"
          type="checkbox"
          checked={form.isPublished}
          onChange={(event) => setForm((current) => ({ ...current, isPublished: event.target.checked }))}
          className="size-4 accent-accent"
        />
        공개
      </label>

      {error ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
          {error}
          {createdWithFailures ? (
            <>
              {' '}
              <Link href={`/admin/gallery/${createdWithFailures}/edit`} className="font-medium underline">
                수정 화면에서 사진 다시 추가
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/gallery')}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
        >
          취소
        </button>
        <SubmitButton
          pendingOverride={isPending}
          pendingLabel={progress || '저장 중...'}
          disabled={!!createdWithFailures}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  )
}
