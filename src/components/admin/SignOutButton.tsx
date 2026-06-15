'use client'

import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export default function SignOutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut()
        router.push('/')
        router.refresh()
      }}
      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-line transition hover:bg-accent-deep hover:text-bg"
    >
      로그아웃
    </button>
  )
}
