import { extractScripture } from './scripture'
import type { ThumbnailStyle, ThumbnailText } from './types'

export interface ComposeSermonInput {
  title: string
  displayTitle?: string | null
  summary?: string | null
  quickSummary?: string[] | null
}

export type HeadlineFn = (sermon: ComposeSermonInput) => Promise<string>

export async function composeThumbnailText(
  style: ThumbnailStyle,
  sermon: ComposeSermonInput,
  headlineFn: HeadlineFn
): Promise<ThumbnailText> {
  const scripture = extractScripture(sermon.summary)
  if (style === 'hook') {
    const headline = await headlineFn(sermon)
    return { headline, scripture }
  }
  return { headline: sermon.displayTitle?.trim() || sermon.title, scripture }
}
