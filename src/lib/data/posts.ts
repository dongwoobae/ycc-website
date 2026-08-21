import { and, desc, eq, isNull, lte, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { posts as postsTable, user, type PostRow } from '@/lib/db/schema'
import { formatKstDate } from '@/lib/date'
import type { Post, PostCategory } from '@/lib/types'

/**
 * 예약 게시: 공개 체크됐지만 게시 시각(publishedAt)이 아직 오지 않은 상태.
 * 공개 페이지에서는 숨겨지고, 시각이 지나면 자동 노출된다(관리자 화면 '예약' 표시용).
 */
export function isScheduled(post: { isPublished: boolean; publishedAt: Date | null }, now: Date = new Date()): boolean {
  return post.isPublished && post.publishedAt != null && post.publishedAt.getTime() > now.getTime()
}

/**
 * 공개 페이지 노출 조건: 공개 체크 + 게시 시각 도달.
 * publishedAt 이 null 인 레거시 행은 즉시 공개로 취급한다.
 * 예약 시각 도달 시점의 캐시 재생성은 QStash 지연 콜백(/api/jobs/publish-post)이
 * 트리거하고, ISR(revalidate 3600)은 백스톱이다.
 */
function publiclyVisible() {
  return and(
    eq(postsTable.isPublished, true),
    or(isNull(postsTable.publishedAt), lte(postsTable.publishedAt, new Date())),
  )
}

type PostListRow = Pick<PostRow, 'id' | 'title' | 'content' | 'category' | 'isPinned' | 'publishedAt' | 'createdAt'>

const postColumns = {
  id: postsTable.id,
  title: postsTable.title,
  content: postsTable.content,
  category: postsTable.category,
  isPinned: postsTable.isPinned,
  publishedAt: postsTable.publishedAt,
  createdAt: postsTable.createdAt,
}

function toPost(row: PostListRow): Post {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? '',
    category: row.category as PostCategory,
    isPinned: row.isPinned,
    publishedAt: formatKstDate(row.publishedAt ?? row.createdAt),
  }
}

export async function getPosts(): Promise<Post[]> {
  const rows = await db
    .select(postColumns)
    .from(postsTable)
    .where(publiclyVisible())
    .orderBy(desc(postsTable.isPinned), desc(postsTable.publishedAt))
  return rows.map(toPost)
}

export async function getPostById(id: string): Promise<Post | undefined> {
  const rows = await db
    .select({ ...postColumns, author: user.name })
    .from(postsTable)
    .leftJoin(user, eq(user.id, postsTable.createdBy))
    .where(and(eq(postsTable.id, id), publiclyVisible()))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  return { ...toPost(row), author: row.author ?? undefined }
}

export interface PostNeighbor {
  id: string
  title: string
  publishedAt: string
}

export interface PostNeighbors {
  prev?: PostNeighbor // 이전(과거) 글
  next?: PostNeighbor // 다음(최신) 글
}

/** 작성일(publishedAt) 내림차순 기준 인접 글. 다음글=최신, 이전글=과거. */
export async function getPostNeighbors(id: string): Promise<PostNeighbors> {
  const rows = await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      publishedAt: postsTable.publishedAt,
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .where(publiclyVisible())
    .orderBy(desc(postsTable.publishedAt))
  const idx = rows.findIndex((row) => row.id === id)
  if (idx === -1) return {}
  const toNeighbor = (row: (typeof rows)[number]): PostNeighbor => ({
    id: row.id,
    title: row.title,
    publishedAt: formatKstDate(row.publishedAt ?? row.createdAt),
  })
  return {
    next: idx > 0 ? toNeighbor(rows[idx - 1]) : undefined,
    prev: idx < rows.length - 1 ? toNeighbor(rows[idx + 1]) : undefined,
  }
}

export async function getLatestPosts(limit = 3): Promise<Post[]> {
  const rows = await db
    .select(postColumns)
    .from(postsTable)
    .where(publiclyVisible())
    .orderBy(desc(postsTable.isPinned), desc(postsTable.publishedAt))
    .limit(limit)
  return rows.map(toPost)
}
