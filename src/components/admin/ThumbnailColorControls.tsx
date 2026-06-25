"use client";

import type { ThumbnailColors } from "@/lib/thumbnails/types";

interface Props {
  value: ThumbnailColors;
  onChange: (colors: ThumbnailColors) => void;
  onCommit: () => void;
  disabled?: boolean;
}

const SWATCH =
  "h-7 w-9 cursor-pointer rounded border border-line bg-transparent disabled:cursor-default disabled:opacity-50";

export default function ThumbnailColorControls({ value, onChange, onCommit, disabled }: Props) {
  return (
    <div>
      <p className="mb-1 text-xs text-ink-muted">문구 색상</p>
      <div className="flex gap-4 text-xs text-ink-muted">
        <label className="flex items-center gap-1.5">
          헤드라인
          <input
            type="color"
            disabled={disabled}
            value={value.headline}
            onChange={(e) => onChange({ ...value, headline: e.target.value })}
            onBlur={onCommit}
            className={SWATCH}
          />
        </label>
        <label className="flex items-center gap-1.5">
          성경구절
          <input
            type="color"
            disabled={disabled}
            value={value.scripture}
            onChange={(e) => onChange({ ...value, scripture: e.target.value })}
            onBlur={onCommit}
            className={SWATCH}
          />
        </label>
      </div>
    </div>
  );
}
