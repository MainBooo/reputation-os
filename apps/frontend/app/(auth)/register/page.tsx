'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { register } from '@/lib/api/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('Demo User')
  const [email, setEmail] = useState('demo@reputation.local')
  const [password, setPassword] = useState('demo123')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result: any = await register({ fullName, email, password })
      if (typeof window !== 'undefined' && result?.accessToken) {
        localStorage.setItem('accessToken', result.accessToken)
        document.cookie = `accessToken=${result.accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
      }
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-muted">Reputation OS</div>
        <h1 className="mt-3 text-2xl font-semibold text-brand">Register</h1>
        <p className="mt-2 text-sm text-muted">Create your workspace and start monitoring.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
