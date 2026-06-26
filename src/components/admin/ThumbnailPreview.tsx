"use client";

import { positionToLayout } from "@/lib/thumbnails/position";
import type { ThumbnailColors, ThumbnailPosition, ThumbnailText } from "@/lib/thumbnails/types";

interface Props {
  background?: string;
  cutout?: string;
  text: ThumbnailText;
  position: ThumbnailPosition;
  colors: ThumbnailColors;
}

// render.tsx와 시각 정합을 맞춘다(1280px 폭 기준 px → cqw 환산, 컨테이너 크기 무관 동일 비율).
const TEXT_SHADOW = "0px 0.16cqw 0.63cqw rgba(0,0,0,0.55)";
const GRADIENT = "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.72) 100%)";

export default function ThumbnailPreview({ background, cutout, text, position, colors }: Props) {
  const layout = positionToLayout(position);

  if (!background) {
    return (
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
        <span className="text-sm text-faint">아직 생성되지 않음</span>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-lg border border-line bg-surface"
      style={{
        containerType: "inline-size",
        display: "flex",
        flexDirection: "column",
        justifyContent: layout.justifyContent,
        alignItems: layout.alignItems,
        fontFamily: "var(--font-pretendard)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={background} alt="썸네일 미리보기" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: GRADIENT }} />
      {cutout ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cutout}
          alt=""
          className="absolute"
          style={{ right: "1.875cqw", bottom: 0, height: "100%", objectFit: "contain" }}
        />
      ) : null}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: layout.alignItems,
          textAlign: layout.textAlign,
          padding: "4.375cqw",
          gap: "1.25cqw",
        }}
      >
        {text.scripture ? (
          <span style={{ fontSize: "2.96875cqw", color: colors.scripture, fontWeight: 700, textShadow: TEXT_SHADOW }}>
            {text.scripture}
          </span>
        ) : null}
        <span
          style={{
            fontSize: "5.9375cqw",
            color: colors.headline,
            fontWeight: 700,
            lineHeight: 1.1,
            textShadow: TEXT_SHADOW,
          }}
        >
          {text.headline}
        </span>
      </div>
    </div>
  );
}
