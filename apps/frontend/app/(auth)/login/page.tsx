'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    try {
      const hasToken = document.cookie.includes('accessToken=')
      if (hasToken) {
        router.replace('/dashboard')
      }
    } catch {}
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result: any = await login({ email, password })

      if (typeof window !== 'undefined' && result?.accessToken) {
        document.cookie = `accessToken=${encodeURIComponent(result.accessToken)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
      }

      router.replace('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Не удалось войти. Проверьте email и пароль.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-muted">Reputation OS</div>
        <h1 className="mt-3 text-2xl font-semibold text-brand">Вход</h1>
        <p className="mt-2 text-sm text-muted">Войдите в рабочее пространство Reputation Inbox.</p>

        <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-4 text-sm text-slate-200">
          <div className="font-medium text-white">Демо-доступ</div>
          <div className="mt-2">Email: <span className="text-cyan-200">demo@reputation.local</span></div>
          <div>Пароль: <span className="text-cyan-200">demo123</span></div>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" />
          {error ? <div className="text-sm text-red-300">{error}</div> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </Button>
        </form>

        <div className="mt-6 text-sm text-muted">
          Нет аккаунта? <a href="/register" className="text-brand">Зарегистрироваться</a>
        </div>
      </Card>
    </div>
  )
}
