'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { register } from '@/lib/api/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const hasToken =
        document.cookie.includes('accessToken=') || !!localStorage.getItem('accessToken')
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
      const result: any = await register({ fullName, email, password })

      if (typeof window !== 'undefined' && result?.accessToken) {
        localStorage.setItem('accessToken', result.accessToken)
        document.cookie = `accessToken=${encodeURIComponent(result.accessToken)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
      }

      router.replace('/dashboard')
      router.refresh()
    } catch (err: any) {
      const msg = err?.message || 'Не удалось создать аккаунт. Проверьте введённые данные.'
      if (String(msg).includes('already exists')) {
        setError('Пользователь с таким email уже существует. Войдите в систему или используйте другой email.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-muted">Reputation OS</div>
        <h1 className="mt-3 text-2xl font-semibold text-brand">Регистрация</h1>
        <p className="mt-2 text-sm text-muted">Создайте рабочее пространство и начните мониторинг.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Имя" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" />
          {error ? <div className="text-sm text-red-300">{error}</div> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Создание аккаунта...' : 'Зарегистрироваться'}
          </Button>
        </form>

        <div className="mt-6 text-sm text-muted">
          Уже есть аккаунт? <a href="/login" className="text-brand">Войти</a>
        </div>
      </Card>
    </div>
  )
}
