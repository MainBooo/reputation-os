'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { login } from '@/lib/api/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('demo@reputation.local')
  const [password, setPassword] = useState('demo123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result: any = await login({ email, password })
      if (typeof window !== 'undefined' && result?.accessToken) {
        localStorage.setItem('accessToken', result.accessToken)
        document.cookie = `accessToken=${result.accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
      }
      router.push('/dashboard')
    } catch (err: any) {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-muted">Reputation OS</div>
        <h1 className="mt-3 text-2xl font-semibold text-brand">Login</h1>
        <p className="mt-2 text-sm text-muted">Access your Reputation Inbox workspace.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          {error ? <div className="text-sm text-red-300">{error}</div> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Loading...' : 'Login'}
          </Button>
        </form>

        <div className="mt-6 text-sm text-muted">
          No account? <a href="/register" className="text-brand">Register</a>
        </div>
      </Card>
    </div>
  )
}
