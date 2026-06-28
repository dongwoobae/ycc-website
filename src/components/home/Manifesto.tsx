import Container from "@/components/layout/Container";
import Reveal from "@/components/ui/Reveal";
import { Eyebrow } from "./HomePrimitives";
import AuroraBackground from "./AuroraBackground";

// 홈 스크롤 #2 — 환영 메시지. 블루→라벤더 그라데이션 위에 오로라 배경.
export default function Manifesto() {
  return (
    <section
      data-home-after-hero
      className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#DCE7F7_0%,#E4E3F4_55%,#ECE6F6_100%)] py-28 min-[960px]:py-36"
    >
      <AuroraBackground />
      <Container size="wide" className="text-center">
        <Reveal>
          <Eyebrow>Welcome</Eyebrow>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-7 max-w-[24ch] text-[clamp(28px,4.6vw,54px)] font-bold leading-[1.42] tracking-tight text-ink">
            오래된 믿음 위에, <span className="text-accent">새로운 은혜</span>가 머무는
            <br />
            영천중앙교회에 오신
            <br />
            여러분 환영합니다
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
