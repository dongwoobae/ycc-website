import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { posts as postsTable, type PostRow } from '@/lib/db/schema'
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
    .select(postColumns)
    .from(postsTable)
    .where(and(eq(postsTable.id, id), eq(postsTable.isPublished, true)))
    .limit(1)
  return rows[0] ? toPost(rows[0]) : undefined
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
