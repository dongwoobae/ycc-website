import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('사용법: npm run delete-user -- <email>')
    process.exit(1)
  }

  const { db } = await import('../src/lib/db')
  const { user } = await import('../src/lib/db/auth-schema')
  const { eq } = await import('drizzle-orm')

  // session/account는 user FK onDelete cascade로 함께 삭제됨
  const deleted = await db.delete(user).where(eq(user.email, email)).returning({ id: user.id })
  console.log(deleted.length ? `삭제 완료: ${email}` : `해당 계정 없음: ${email}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
