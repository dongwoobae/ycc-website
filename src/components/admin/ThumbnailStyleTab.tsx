"use client";

import { useState, useTransition } from "react";
import {
  generateThumbnailAction,
  repositionThumbnailAction,
  suggestThumbnailTextAction,
} from "@/lib/actions/thumbnails";
import {
  DEFAULT_THUMBNAIL_POSITION,
  type ThumbnailCandidate,
  type ThumbnailPosition,
  type ThumbnailStyle,
  type ThumbnailText,
} from "@/lib/thumbnails/types";
import ThumbnailPositionGrid from "./ThumbnailPositionGrid";

interface Props {
  sermonId: string;
  style: ThumbnailStyle;
  description: string;
  existing?: ThumbnailCandidate;
  onApply: (url: string) => void;
  applying: boolean;
}

export default function ThumbnailStyleTab({ sermonId, style, description, existing, onApply, applying }: Props) {
  const [text, setText] = useState<ThumbnailText>({ headline: "", scripture: "" });
  const [preview, setPreview] = useState<string | undefined>(existing?.url);
  const [position, setPosition] = useState<ThumbnailPosition>(DEFAULT_THUMBNAIL_POSITION);
  const [loadingText, setLoadingText] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  // 문구(헤드라인·성경구절)는 진입 시 자동 호출하지 않고 버튼으로만 불러온다(불필요한 Gemini 호출 방지).
  function loadText() {
    setMsg("");
    setLoadingText(true);
    start(async () => {
      try {
        setText(await suggestThumbnailTextAction(sermonId, style));
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingText(false);
      }
    });
  }

  function generate() {
    setMsg("");
    start(async () => {
      try {
        const { candidate } = await generateThumbnailAction(sermonId, style, text, position);
        setPreview(candidate.url);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
      }
    });
  }

  // 배경이 이미 있으면(=미리보기 존재) 텍스트만 재합성해 위치 이동(무비용). 없으면 위치만 저장.
  function changePosition(next: ThumbnailPosition) {
    setPosition(next);
    if (!preview) return;
    setMsg("");
    start(async () => {
      try {
        const { candidate } = await repositionThumbnailAction(sermonId, style, text, next);
        setPreview(candidate.url);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{description}</p>
        <button
          type="button"
          onClick={loadText}
          disabled={pending || loadingText}
          className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs disabled:opacity-50"
        >
          {loadingText ? "문구 불러오는 중…" : "문구 생성"}
        </button>
      </div>
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
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="썸네일 미리보기" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-faint">아직 생성되지 않음</span>
        )}
      </div>
      <ThumbnailPositionGrid value={position} onChange={changePosition} disabled={pending} />
      <p className="text-xs text-amber-600">⚠ 생성 시 OpenAI 이미지 비용이 발생합니다. (위치 이동은 무비용)</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-md bg-accent-deep px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {preview ? "재생성" : "썸네일 생성"}
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
  );
}
