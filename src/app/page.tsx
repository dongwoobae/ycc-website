import ImmersiveHero from '@/components/home/ImmersiveHero'
import Manifesto from '@/components/home/Manifesto'
import FullBleedBand from '@/components/home/FullBleedBand'
import WorshipTimes from '@/components/home/WorshipTimes'
import Gallery from '@/components/home/Gallery'
import NextGenCommunity from '@/components/home/NextGenCommunity'
import RecentSermons from '@/components/home/RecentSermons'
import Verse from '@/components/home/Verse'
import Visit from '@/components/home/Visit'
import CtaBand from '@/components/home/CtaBand'
import { getLatestSermons } from '@/lib/data/sermons'

export const revalidate = 3600

export default async function HomePage() {
  const sermons = await getLatestSermons(3)

  return (
    <>
      <ImmersiveHero />
      <Manifesto />
      <FullBleedBand />
      <WorshipTimes />
      <Gallery />
      <NextGenCommunity />
      <RecentSermons sermons={sermons} />
      <Verse />
      <Visit />
      <CtaBand />
    </>
  )
}
