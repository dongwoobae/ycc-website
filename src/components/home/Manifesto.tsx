import Container from "@/components/layout/Container";
import Reveal from "@/components/ui/Reveal";
import { Eyebrow } from "./HomePrimitives";

// 홈 스크롤 #2 — 환영 메시지. 히어로(#1, 밝은 하늘 단색)보다 한 단계 진한
// 페리윙클 단색으로 내려, 스크롤이 더 깊은 공간으로 이어지는 느낌을 준다.
export default function Manifesto() {
  return (
    <section className="relative isolate overflow-hidden border-t border-white/50 bg-[rgb(184_200_234)] py-28 min-[960px]:py-36">
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
