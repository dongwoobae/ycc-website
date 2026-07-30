'use server'

import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { revalidatePostPaths } from '@/lib/posts/revalidate'
import { publishJob } from '@/lib/qstash'
import type { PostCategory } from '@/lib/types'

export interface PostFormInput {
  title: string
  content: string
  category: PostCategory
  isPinned: boolean
  isPublished: boolean
  /** 예약 게시 시각(KST, 'YYYY-MM-DDTHH:mm'). null 이면 즉시 공개(생성) 또는 기존 게시 시각 유지(수정). */
  publishedAt: string | null
}

const categories: PostCategory[] = ['공지', '소식', '행사']

function parsePostInput(input: PostFormInput) {
  const title = input.title.trim()
  if (!title) throw new Error('title is required')
  if (!categories.includes(input.category)) throw new Error('invalid category')

  const scheduledAt = input.publishedAt ? new Date(`${input.publishedAt}:00+09:00`) : null
  if (input.publishedAt && Number.isNaN(scheduledAt?.getTime())) {
    throw new Error('invalid publishedAt')
  }

  return {
    title,
    content: input.content.trim() || null,
    category: input.category,
    isPinned: input.isPinned,
    isPublished: input.isPublished,
    scheduledAt,
  }
}

/**
 * 예약 시각이 이미 지났으면 저장 시각으로 즉시 공개 처리한다(낙관 처리).
 * 예: 14:00 예약으로 열어두고 14:05 에 저장하면 14:05 게시로 바로 공개.
 */
function resolveScheduledAt(scheduledAt: Date, now: Date): Date {
  return scheduledAt.getTime() > now.getTime() ? scheduledAt : now
}

/**
 * 예약 게시라면 공개 시각에 캐시가 재생성되도록 QStash 지연 콜백을 건다.
 * +10초 버퍼로 콜백이 항상 공개 시각 이후에 도착하게 한다(이전 도착 시 재생성돼도
 * 아직 비노출이라 낡은 캐시가 남는다). 콜백은 멱등 revalidate 뿐이라 예약 변경으로
 * 낡은 메시지가 남아도 취소할 필요가 없다. 발행 실패는 저장을 막지 않는다 —
 * ISR(revalidate 3600)이 백스톱으로 최대 1시간 내에 노출시킨다.
 */
async function schedulePublishRevalidate(id: string, publishedAt: Date, now: Date) {
  if (publishedAt.getTime() <= now.getTime()) return
  const delaySeconds = Math.ceil((publishedAt.getTime() - now.getTime()) / 1000) + 10
  try {
    await publishJob('publish-post', { postId: id }, delaySeconds)
  } catch (error) {
    console.error('failed to schedule publish-post revalidate', { id, error })
  }
}

export async function createPost(input: PostFormInput) {
  const s = await requireAdmin()
  const { scheduledAt, ...values } = parsePostInput(input)
  const now = new Date()
  // 예약이 아니면 저장 시각이 곧 게시 시각
  const publishedAt = scheduledAt ? resolveScheduledAt(scheduledAt, now) : now
  const [created] = await db
    .insert(posts)
    .values({
      ...values,
      publishedAt,
      createdBy: s.user.id,
    })
    .returning({ id: posts.id, title: posts.title })

  if (!created) throw new Error('failed to create post')
  await log('create', 'post', created.id, created.title, s.user.id)
  if (values.isPublished) await schedulePublishRevalidate(created.id, publishedAt, now)
  revalidatePostPaths(created.id)
  return created.id
}

export async function updatePost(id: string, input: PostFormInput) {
  const s = await requireAdmin()
  const { scheduledAt, ...values } = parsePostInput(input)

  const [existing] = await db
    .select({ isPublished: posts.isPublished, publishedAt: posts.publishedAt })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1)
  if (!existing) throw new Error('post not found')

  // 게시 시각 결정:
  // - 예약 지정 → 그 시각(지났으면 저장 시각으로 즉시 공개)
  // - 비공개→공개 전환, 예약 해제(기존 시각이 미래), 레거시(null) → 저장 시각
  // - 그 외 → 기존 게시 시각 유지(수정해도 게시일이 바뀌지 않게)
  const now = new Date()
  let publishedAt: Date
  if (scheduledAt) {
    publishedAt = resolveScheduledAt(scheduledAt, now)
  } else if (!existing.isPublished && values.isPublished) {
    publishedAt = now
  } else if (existing.publishedAt == null || existing.publishedAt.getTime() > now.getTime()) {
    publishedAt = now
  } else {
    publishedAt = existing.publishedAt
  }

  const [updated] = await db
    .update(posts)
    .set({
      ...values,
      publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, title: posts.title })

  if (!updated) throw new Error('post not found')
  await log('update', 'post', updated.id, updated.title, s.user.id)
  if (values.isPublished) await schedulePublishRevalidate(updated.id, publishedAt, now)
  revalidatePostPaths(updated.id)
}

export async function deletePost(id: string) {
  const s = await requireAdmin()
  const [deleted] = await db
    .delete(posts)
    .where(eq(posts.id, id))
    .returning({ id: posts.id, title: posts.title })

  if (!deleted) throw new Error('post not found')
  await log('delete', 'post', deleted.id, deleted.title, s.user.id)
  revalidatePostPaths(deleted.id)
}

export async function togglePin(id: string, isPinned: boolean) {
  const s = await requireAdmin()
  const [updated] = await db
    .update(posts)
    .set({
      isPinned,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, title: posts.title })

  if (!updated) throw new Error('post not found')
  await log('update', 'post', updated.id, updated.title, s.user.id)
  revalidatePostPaths(updated.id)
}
