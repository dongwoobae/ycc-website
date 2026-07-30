'use client'

import { FormEvent, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PostFormInput } from '@/lib/actions/posts'
import { formatKstDateTimeInput, nextFullHourKstInput } from '@/lib/date'
import type { PostCategory } from '@/lib/types'

const categories: PostCategory[] = ['공지', '소식', '행사']

// 바로 공개(기본): 저장 시각이 곧 게시 시각 · 예약 게시: 지정 시각부터 공개 · 비공개: 목록에서 숨김
type PublishMode = 'now' | 'scheduled' | 'private'

const publishModes: { value: PublishMode; label: string }[] = [
  { value: 'now', label: '바로 공개' },
  { value: 'scheduled', label: '예약 게시' },
  { value: 'private', label: '비공개' },
]

interface PostFormProps {
  initialValue?: PostFormInput
  submitLabel: string
  submitAction: (input: PostFormInput) => Promise<string | void>
}

function initialMode(initialValue?: PostFormInput): PublishMode {
  if (!initialValue) return 'now'
  if (!initialValue.isPublished) return 'private'
  // edit 페이지는 예약 상태(게시 시각이 미래)일 때만 publishedAt 을 전달한다
  return initialValue.publishedAt ? 'scheduled' : 'now'
}

export default function PostForm({ initialValue, submitLabel, submitAction }: PostFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [content, setContent] = useState(initialValue?.content ?? '')
  const [category, setCategory] = useState<PostCategory>(initialValue?.category ?? '공지')
  const [isPinned, setIsPinned] = useState(initialValue?.isPinned ?? false)
  const [mode, setMode] = useState<PublishMode>(() => initialMode(initialValue))
  const [scheduledAt, setScheduledAt] = useState(() => initialValue?.publishedAt ?? nextFullHourKstInput())
  // 과거 시각 선택 방지용 하한. 폼을 연 시점 기준이라 열어둔 채 시간이 지나면
  // 지난 시각도 제출될 수 있는데, 그 경우 서버가 저장 시각으로 즉시 공개 처리한다.
  const [minScheduledAt] = useState(() => formatKstDateTimeInput(new Date()))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        await submitAction({
          title,
          content,
          category,
          isPinned,
          isPublished: mode !== 'private',
          publishedAt: mode === 'scheduled' ? scheduledAt : null,
        })
        router.push('/admin/posts')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl bg-paper p-6 shadow-sm">
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-medium text-ink">
          제목
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          required
        />
      </div>

      <div>
        <label htmlFor="content" className="mb-2 block text-sm font-medium text-ink">
          내용
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-72 w-full resize-y rounded-lg border border-line bg-bg px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-accent"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="category" className="mb-2 block text-sm font-medium text-ink">
            카테고리
          </label>
          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as PostCategory)}
            className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-ink">게시 상태</span>
          <div className="flex flex-wrap items-center gap-4 py-3">
            {publishModes.map((item) => (
              <label key={item.value} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="publishMode"
                  value={item.value}
                  checked={mode === item.value}
                  onChange={() => setMode(item.value)}
                  className="size-4 accent-accent"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {mode === 'scheduled' && (
        <div>
          <label htmlFor="scheduledAt" className="mb-2 block text-sm font-medium text-ink">
            게시 시각
          </label>
          <input
            id="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            min={minScheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            required
            className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent md:max-w-xs"
          />
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            설정 시각에 자동으로 공개됩니다. 이미 지난 시각이면 저장 즉시 공개됩니다.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(event) => setIsPinned(event.target.checked)}
            className="size-4 accent-accent"
          />
          상단 고정
        </label>
      </div>

      {error ? <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/posts')}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? '저장 중...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
