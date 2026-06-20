'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import type { PostCategory } from '@/lib/types'

export interface PostFormInput {
  title: string
  content: string
  category: PostCategory
  isPinned: boolean
  isPublished: boolean
  publishedAt: string
}

const categories: PostCategory[] = ['공지', '소식', '행사']

function parsePostInput(input: PostFormInput) {
  const title = input.title.trim()
  if (!title) throw new Error('title is required')
  if (!categories.includes(input.category)) throw new Error('invalid category')

  const publishedAt = input.publishedAt ? new Date(`${input.publishedAt}T00:00:00+09:00`) : null
  if (input.publishedAt && Number.isNaN(publishedAt?.getTime())) {
    throw new Error('invalid publishedAt')
  }

  return {
    title,
    content: input.content.trim() || null,
    category: input.category,
    isPinned: input.isPinned,
    isPublished: input.isPublished,
    publishedAt,
  }
}

function revalidatePostPaths(id?: string) {
  revalidatePath('/')
  revalidatePath('/news')
  revalidatePath('/admin/posts')
  if (id) revalidatePath(`/news/${id}`)
}

export async function createPost(input: PostFormInput) {
  const s = await requireAdmin()
  const values = parsePostInput(input)
  const [created] = await db
    .insert(posts)
    .values({
      ...values,
      createdBy: null,
    })
    .returning({ id: posts.id, title: posts.title })

  if (!created) throw new Error('failed to create post')
  await log('create', 'post', created.id, created.title, s.user.id)
  revalidatePostPaths(created.id)
  return created.id
}

export async function updatePost(id: string, input: PostFormInput) {
  const s = await requireAdmin()
  const values = parsePostInput(input)
  const [updated] = await db
    .update(posts)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, title: posts.title })

  if (!updated) throw new Error('post not found')
  await log('update', 'post', updated.id, updated.title, s.user.id)
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
