'use client'

import { FormEvent, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PostFormInput } from '@/lib/actions/posts'
import type { PostCategory } from '@/lib/types'

const categories: PostCategory[] = ['공지', '소식', '행사']

interface PostFormProps {
  initialValue?: PostFormInput
  submitLabel: string
  submitAction: (input: PostFormInput) => Promise<string | void>
}

const emptyPost: PostFormInput = {
  title: '',
  content: '',
  category: '공지',
  isPinned: false,
  isPublished: true,
  publishedAt: new Date().toISOString().slice(0, 10),
}

export default function PostForm({ initialValue, submitLabel, submitAction }: PostFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState<PostFormInput>(initialValue ?? emptyPost)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        await submitAction(form)
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
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
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
          value={form.content}
          onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
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
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({ ...current, category: event.target.value as PostCategory }))
            }
            className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="publishedAt" className="mb-2 block text-sm font-medium text-ink">
            게시일
          </label>
          <input
            id="publishedAt"
            type="date"
            value={form.publishedAt}
            onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))}
            className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.isPinned}
            onChange={(event) => setForm((current) => ({ ...current, isPinned: event.target.checked }))}
            className="size-4 accent-accent"
          />
          상단 고정
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(event) => setForm((current) => ({ ...current, isPublished: event.target.checked }))}
            className="size-4 accent-accent"
          />
          공개
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
