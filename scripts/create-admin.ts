import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]
  const name = process.argv[4] ?? '관리자'

  if (!email || !password) {
    console.error('사용법: npm run create-admin -- <email> <password> [name]')
    process.exit(1)
  }

  // 메인 auth는 disableSignUp:true 라 공개 가입 차단됨.
  // 관리자 수동 생성은 가입 허용된 별도 인스턴스로(같은 DB/테이블) 처리.
  const { betterAuth } = await import('better-auth')
  const { drizzleAdapter } = await import('better-auth/adapters/drizzle')
  const { db } = await import('../src/lib/db')
  const { user, session, account, verification } = await import('../src/lib/db/auth-schema')

  const adminAuth = betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification } }),
    emailAndPassword: { enabled: true, disableSignUp: false },
  })

  await adminAuth.api.signUpEmail({ body: { email, password, name } })
  console.log('관리자 생성 완료:', email)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
