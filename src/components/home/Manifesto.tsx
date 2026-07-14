import Container from "@/components/layout/Container";
import Reveal from "@/components/ui/Reveal";
import { Eyebrow } from "./HomePrimitives";

// 홈 스크롤 #2 — 환영 메시지. 부드러운 블루→라벤더 그라데이션 배경.
export default function Manifesto() {
  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#DCE7F7_0%,#E4E3F4_55%,#ECE6F6_100%)] py-28 min-[960px]:py-36">
      <Container size="wide" className="text-center">
        <Reveal>
          <Eyebrow>Welcome</Eyebrow>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-7 max-w-[60rem] text-balance break-keep text-[clamp(22px,3.4vw,40px)] font-bold leading-[1.5] tracking-tight text-ink">
            오래된 믿음 위에,
            <br className="hidden min-[600px]:block" />
            새로운 은혜가 머무는 영천중앙교회에 오신
            <br className="hidden min-[600px]:block" />
            여러분 환영합니다
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
