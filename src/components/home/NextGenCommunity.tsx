import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow, ImagePlaceholder } from './HomePrimitives'

const cards = [
  {
    kicker: '다음세대',
    title: '아이도 부모도 함께',
    body: '유치부부터 청년까지 연령별 예배와 돌봄이 이어집니다. 부모는 예배에 집중하고, 아이들은 안전하게 자라갑니다.',
    image: '다음세대 예배 사진',
  },
  {
    kicker: '공동체',
    title: '구역이 살아나는 교회',
    body: '비슷한 삶의 자리를 나누는 작은 모임으로 만나 서로의 짐을 나누고 함께 기도합니다.',
    image: '구역과 소그룹 모임 사진',
  },
]

export default function NextGenCommunity() {
  return (
    <section id="community" className="bg-surface py-24 min-[960px]:py-32">
      <Container size="wide">
        <Reveal>
          <Eyebrow>Next gen &amp; community</Eyebrow>
          <h2 className="mt-4 text-[clamp(30px,4.4vw,52px)] font-extrabold leading-tight tracking-tight text-ink">
            함께 <span className="text-accent">자라는</span> 사람들
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 min-[960px]:grid-cols-2">
          {cards.map((card, index) => (
            <Reveal key={card.kicker} delay={index * 100}>
              <article className="h-full overflow-hidden rounded-[20px] border border-line bg-paper">
                <div className="h-[300px]">
                  <ImagePlaceholder label={card.image} />
                </div>
                <div className="p-8">
                  <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">{card.kicker}</p>
                  <h3 className="mt-3 font-serif text-[26px] font-extrabold tracking-tight text-ink">{card.title}</h3>
                  <p className="mt-3 leading-7 text-ink-muted">{card.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
