import Image from 'next/image'
import { churchInfo } from '@/lib/church'

/** PCK 공식 휘장을 흰 라운드 배지에 담아 렌더 (다크 블루 바에서도 또렷하게 분리) */
function EmblemBadge({ size = 44 }: { size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-2xl bg-white shadow-[0_6px_16px_rgb(30_42_69_/_0.18)]"
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/pck-emblem.png"
        alt={`${churchInfo.denomination} 총회 휘장`}
        width={size}
        height={size}
        className="h-[78%] w-[78%] object-contain"
        priority
      />
    </span>
  )
}

export default function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-3 leading-none">
      <EmblemBadge size={44} />
      <span className="text-[23px] font-extrabold tracking-tight">{churchInfo.name}</span>
    </span>
  )
}
