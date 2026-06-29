"use client";

import { useState, useTransition } from "react";
import { suggestThumbnailTextAction } from "@/lib/actions/thumbnails";
import { useThumbnailGenerate } from "./useThumbnailGenerate";
import {
  DEFAULT_THUMBNAIL_COLORS,
  DEFAULT_THUMBNAIL_POSITION,
  type ThumbnailColors,
  type ThumbnailPosition,
  type ThumbnailRenderOptions,
  type ThumbnailStyle,
  type ThumbnailText,
} from "@/lib/thumbnails/types";
import ThumbnailPositionGrid from "./ThumbnailPositionGrid";
import ThumbnailColorControls from "./ThumbnailColorControls";
import ThumbnailPreview from "./ThumbnailPreview";

interface Props {
  sermonId: string;
  style: ThumbnailStyle;
  description: string;
  background?: string;
  cutout?: string;
  onApply: (text: ThumbnailText, options: ThumbnailRenderOptions) => void;
  applying: boolean;
}

export default function ThumbnailStyleTab({ sermonId, style, description, background: initialBackground, cutout: initialCutout, onApply, applying }: Props) {
  const [text, setText] = useState<ThumbnailText>({ headline: "", scripture: "" });
  const [background, setBackground] = useState<string | undefined>(initialBackground);
  const [cutout, setCutout] = useState<string | undefined>(initialCutout);
  const [position, setPosition] = useState<ThumbnailPosition>(DEFAULT_THUMBNAIL_POSITION);
  const [colors, setColors] = useState<ThumbnailColors>(DEFAULT_THUMBNAIL_COLORS);
  const [loadingText, setLoadingText] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const { generating, progress, generate: runGenerate } = useThumbnailGenerate();
  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

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

  // 배경 생성(OpenAI 비용 발생). SSE로 단계별 진행률을 받으며, 텍스트 합성은
  // 아래 미리보기가 클라이언트에서 즉시 처리한다.
  async function generate() {
    setMsg("");
    try {
      const { backgroundUrl, cutoutUrl } = await runGenerate(sermonId, style);
      setBackground(backgroundUrl);
      if (cutoutUrl) setCutout(cutoutUrl);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{description}</p>
        <button
          type="button"
          onClick={loadText}
          disabled={pending || loadingText || generating}
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
      <ThumbnailPreview background={background} cutout={style === "cutout" ? cutout : undefined} text={text} position={position} colors={colors} />
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        <ThumbnailPositionGrid value={position} onChange={setPosition} disabled={pending || generating} />
        <ThumbnailColorControls value={colors} onChange={setColors} disabled={pending || generating} />
      </div>
      {generating && progress ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">{progress.phase || "처리 중..."}</span>
            <span className="text-ink-muted">
              {progress.current} / {progress.total}단계
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-2 rounded-full bg-accent-deep transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-ink-muted">생성 중에는 창을 닫지 마세요.</p>
        </div>
      ) : (
        <p className="text-xs text-amber-600">⚠ 생성 시 OpenAI 이미지 비용이 발생합니다. (위치·색상 변경은 무비용)</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={pending || generating}
          className="rounded-md bg-accent-deep px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {generating ? "생성 중…" : background ? "배경 재생성" : "썸네일 생성"}
        </button>
        {background && (
          <button
            type="button"
            onClick={() => onApply(text, { position, colors })}
            disabled={applying || pending || generating}
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
