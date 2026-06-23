import Container from "@/components/layout/Container";
import Reveal from "@/components/ui/Reveal";
import { Eyebrow } from "./HomePrimitives";

export default function Manifesto() {
  return (
    <section data-home-after-hero className="bg-bg py-24 min-[960px]:py-32">
      <Container size="wide" className="text-center">
        <Reveal>
          <Eyebrow>Our heart</Eyebrow>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-6 max-w-[20ch] text-[clamp(28px,4.4vw,52px)] font-bold leading-[1.34] tracking-tight text-ink">
            일에 지치고, 관계에 마음 쓰고, 아이를 세우며 살아가는 당신에게.
            <br />
            <span className="text-accent">쉼과 소망</span>이 되는 교회이고 싶습니다.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <p className="mx-auto mt-8 max-w-[50ch] text-[17px] leading-8 text-ink-muted">
            화려한 무엇보다 진실한 예배와 서로를 돌보는 사람들. 영천중앙교회는 이웃과 함께 걸으며 삶의 자리에 닿는
            공동체를 꿈꿉니다.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
