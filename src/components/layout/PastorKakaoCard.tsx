import Image from 'next/image'

const KAKAO_URL = 'https://qr.kakao.com/talk/AyhAG5qS936F.2Usitr1y420Va4-'
const KAKAO_ID = 'apple3035'

export default function PastorKakaoCard() {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-paper p-5">
      <Image
        src="/images/pastor-kakao-qr.png"
        alt="담임목사 김선찬 카카오톡 QR 코드"
        width={104}
        height={104}
        className="h-[104px] w-[104px] shrink-0 rounded-lg border border-line bg-white p-1.5"
      />
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">KakaoTalk</p>
        <p className="mt-1.5 text-lg font-extrabold tracking-tight text-ink">담임목사 김선찬</p>
        <p className="mt-0.5 text-sm text-ink-muted">
          카카오톡 ID <span className="font-semibold text-ink">{KAKAO_ID}</span>
        </p>
        <a
          href={KAKAO_URL}
          target="_blank"
          rel="noreferrer"
          className="motion-hover mt-3 inline-flex items-center gap-2 rounded-full border border-[#FEE500] bg-[#FEE500] px-5 py-2.5 text-sm font-bold text-[#3a2929] transition hover:-translate-y-0.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.6-.2.7-.7 2.6-.8 3 0 0-.02.2.1.27.12.08.27.02.27.02.36-.05 2.8-1.85 3.4-2.27.7.1 1.5.15 2.3.15 5.5 0 10-3.5 10-7.8S17.5 3 12 3z" />
          </svg>
          카카오톡으로 문의
        </a>
        <p className="mt-2 text-[12.5px] text-faint">데스크톱에서는 QR을 휴대폰으로 스캔해 주세요.</p>
      </div>
    </div>
  )
}
