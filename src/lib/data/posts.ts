import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { posts as postsTable, profiles, type PostRow } from '@/lib/db/schema'
import { formatKstDate } from '@/lib/date'
import type { Post, PostCategory } from '@/lib/types'

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
    .where(eq(postsTable.isPublished, true))
    .orderBy(desc(postsTable.isPinned), desc(postsTable.publishedAt))
  return rows.map(toPost)
}

export async function getPostById(id: string): Promise<Post | undefined> {
  const rows = await db
    .select({ ...postColumns, author: profiles.fullName })
    .from(postsTable)
    .leftJoin(profiles, eq(profiles.id, postsTable.createdBy))
    .where(and(eq(postsTable.id, id), eq(postsTable.isPublished, true)))
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
    .where(eq(postsTable.isPublished, true))
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
    .where(eq(postsTable.isPublished, true))
    .orderBy(desc(postsTable.isPinned), desc(postsTable.publishedAt))
    .limit(limit)
  return rows.map(toPost)
}
