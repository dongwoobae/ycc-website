'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import Container from '@/components/layout/Container'
import { churchInfo } from '@/lib/church'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await authClient.signIn.email({ email, password })
    setLoading(false)
    if (signInError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="py-20">
      <Container className="max-w-md">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">관리자 로그인</h1>
        <p className="mt-3 text-sm text-ink-muted">{churchInfo.name} 관리자 전용 페이지입니다.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border border-line bg-paper p-6 shadow-subtle">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink">
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
          {error && <p className="text-sm text-accent-deep">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-bg transition hover:bg-accent-deep disabled:opacity-60"
          >
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </Container>
    </div>
  )
}
