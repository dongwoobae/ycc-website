import ImmersiveHero from '@/components/home/ImmersiveHero'
import Manifesto from '@/components/home/Manifesto'
import FullBleedBand from '@/components/home/FullBleedBand'
import EntryCards from '@/components/home/EntryCards'
import HomeScrollController from '@/components/home/HomeScrollController'
import { getLatestSermons } from '@/lib/data/sermons'

export const revalidate = 3600

// AI 설교요약 첫 문장만 추출 (#4 말씀 카드 "한줄요약")
function firstSentence(summary?: string): string | null {
  if (!summary) return null
  const trimmed = summary.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^.*?[.!?。](\s|$)/)
  const sentence = (match ? match[0] : trimmed).trim()
  return sentence.length > 80 ? `${sentence.slice(0, 80).trim()}…` : sentence
}

export default async function HomePage() {
  const sermons = await getLatestSermons(3)
  const sermonSummary = firstSentence(sermons.find((s) => s.summary)?.summary)

  return (
    <div className="home-scroll-page">
      <HomeScrollController />
      <ImmersiveHero />
      <Manifesto />
      <FullBleedBand />
      <EntryCards sermonSummary={sermonSummary} />
    </div>
  )
}
