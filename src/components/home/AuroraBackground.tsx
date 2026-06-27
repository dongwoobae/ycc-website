// 오로라 배경 — 부모에 `relative isolate overflow-hidden` 필요.
// 섹션 배경 그라데이션 위, 콘텐츠 아래(-z-10)에 부드러운 블러 블롭을 띄운다.
export default function AuroraBackground({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <span className="aurora-blob aurora-blob--a" />
      <span className="aurora-blob aurora-blob--b" />
      <span className="aurora-blob aurora-blob--c" />
      <span className="aurora-blob aurora-blob--d" />
    </div>
  )
}
