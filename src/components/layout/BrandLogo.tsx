type BrandLogoProps = {
  variant?: 'header' | 'sidebar'
}

export function LogoMark({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <svg className={className} viewBox="0 0 48 48" role="img" aria-label="영천중앙교회 로고">
        <defs>
          <linearGradient id="yccCompactSky" x1="8" x2="40" y1="5" y2="43" gradientUnits="userSpaceOnUse">
            <stop stopColor="#57A0FF" />
            <stop offset="1" stopColor="#2764CA" />
          </linearGradient>
          <linearGradient id="yccCompactGold" x1="12" x2="38" y1="41" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F2D479" />
            <stop offset="1" stopColor="#D9A944" />
          </linearGradient>
        </defs>
        <path d="M24 4C15.4 10.1 9.2 19 8.2 27.6c6.2 4.5 25.4 4.5 31.6 0C38.8 19 32.6 10.1 24 4Z" fill="url(#yccCompactSky)" />
        <path d="M8.2 27.6c6.2 9.8 25.4 9.8 31.6 0C38.5 38.3 31.8 45 24 45S9.5 38.3 8.2 27.6Z" fill="url(#yccCompactGold)" />
        <path d="M21.6 12.8h4.8v11h10.2v4.9H26.4v12h-4.8v-12H11.4v-4.9h10.2v-11Z" fill="#FFFFFF" />
        <path d="M13.5 34.3c4.5 2.8 9 4.1 13.8 4.1 2.8 0 5.3-.4 7.4-1.2" fill="none" stroke="#FFF4CF" strokeWidth="3.6" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg className={className} viewBox="0 0 96 96" role="img" aria-label="영천중앙교회 로고">
      <defs>
        <linearGradient id="yccLogoSky" x1="18" x2="80" y1="16" y2="84" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3C82E6" />
          <stop offset="1" stopColor="#1F4C9C" />
        </linearGradient>
        <linearGradient id="yccLogoGold" x1="25" x2="72" y1="73" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E8C56B" />
          <stop offset="1" stopColor="#C99634" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="28" fill="#F8FBFF" />
      <path
        d="M20 55c11.8 13.9 43.7 13.9 56 0-2.5 17.4-14.6 29-28 29S22.5 72.4 20 55Z"
        fill="url(#yccLogoGold)"
      />
      <path
        d="M48 12c15.9 11 27.3 27.5 28 43-12.3 8-43.7 8-56 0 .7-15.5 12.1-32 28-43Z"
        fill="url(#yccLogoSky)"
      />
      <path d="M43.5 27h9v17h16v8.5h-16V73h-9V52.5h-16V44h16V27Z" fill="#FFFFFF" />
      <path d="M29 66.5c7.7 4.6 15.8 6.9 24.6 6.9 5.1 0 9.6-.7 13.4-2.2" fill="none" stroke="#FFF4CF" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export default function BrandLogo({ variant = 'header' }: BrandLogoProps) {
  if (variant === 'sidebar') {
    return (
      <>
        <span className="ycc-mark">
          <LogoMark compact />
        </span>
        <span className="ycc-wordmark">
          <b>영천중앙교회</b>
          <small>YEONGCHEON CENTRAL</small>
        </span>
      </>
    )
  }

  return (
    <span className="inline-flex items-center gap-3 leading-none">
      <LogoMark className="h-11 w-11 flex-none drop-shadow-[0_8px_18px_rgb(30_42_69_/_0.12)]" />
      <span className="flex flex-col">
        <span className="font-serif text-[21px] font-extrabold tracking-tight">영천중앙교회</span>
        <span className="mt-1 text-[10px] font-semibold tracking-[0.24em] text-accent">YEONGCHEON CENTRAL</span>
      </span>
    </span>
  )
}
