import KakaoMap from '@/components/layout/KakaoMap'
import VisitBlock, { VisitInfo } from '@/components/layout/VisitBlock'

export default function Visit() {
  return (
    <VisitBlock
      eyebrow="Visit us"
      title={
        <>
          다시 오시는 <span className="text-accent">길</span>
        </>
      }
      className="bg-surface py-24 min-[960px]:py-32"
      media={
        <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
          <KakaoMap />
        </div>
      }
      details={
        <VisitInfo label="Parking">
          <p className="font-semibold leading-7 text-ink-muted">
            교회 주차장을 이용하실 수 있으며, 주일에는 안내위원이 안내해드립니다.
          </p>
        </VisitInfo>
      }
      showPastorKakao
    />
  )
}
