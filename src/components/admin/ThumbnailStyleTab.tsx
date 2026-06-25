'use client'

import { useState, useTransition } from 'react'
import { generateThumbnailAction, suggestThumbnailTextAction } from '@/lib/actions/thumbnails'
import type { ThumbnailCandidate, ThumbnailStyle, ThumbnailText } from '@/lib/thumbnails/types'

interface Props {
  sermonId: string
  style: ThumbnailStyle
  description: string
  existing?: ThumbnailCandidate
  onApply: (url: string) => void
  applying: boolean
}

export default function ThumbnailStyleTab({ sermonId, style, description, existing, onApply, applying }: Props) {
  const [text, setText] = useState<ThumbnailText>({ headline: '', scripture: '' })
  const [preview, setPreview] = useState<string | undefined>(existing?.url)
  const [loaded, setLoaded] = useState(false)
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()

  function autofill() {
    setMsg('')
    start(async () => {
      try {
        setText(await suggestThumbnailTextAction(sermonId, style))
        setLoaded(true)
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e))
      }
    })
  }

  function generate() {
    setMsg('')
    start(async () => {
      try {
        const { candidate } = await generateThumbnailAction(sermonId, style, text)
        setPreview(candidate.url)
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{description}</p>
      {!loaded && !existing ? (
        <button
          type="button"
          onClick={autofill}
          disabled={pending}
          className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-50"
        >
          문구 불러오기
        </button>
      ) : (
        <div className="grid gap-2">
          <input
            className="rounded-md border border-line px-3 py-2 text-sm"
            placeholder="헤드라인"
            value={text.headline}
            onChange={(e) => setText((t) => ({ ...t, headline: e.target.value }))}
          />
          <input
            className="rounded-md border border-line px-3 py-2 text-sm"
            placeholder="성경구절"
            value={text.scripture}
            onChange={(e) => setText((t) => ({ ...t, scripture: e.target.value }))}
          />
        </div>
      )}
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="썸네일 미리보기" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-faint">아직 생성되지 않음</span>
        )}
      </div>
      <p className="text-xs text-amber-600">⚠ 생성 시 OpenAI 이미지 비용이 발생합니다.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-md bg-accent-deep px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {preview ? '재생성' : '썸네일 생성'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={() => onApply(preview)}
            disabled={applying}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            이 썸네일로 적용
          </button>
        )}
        {msg && <span className="self-center text-sm text-red-600">{msg}</span>}
      </div>
    </div>
  )
}
