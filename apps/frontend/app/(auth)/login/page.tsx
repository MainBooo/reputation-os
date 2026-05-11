'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MonitorCheck,
  ShieldCheck,
  Sparkles,
  Waves,
  Zap
} from 'lucide-react'
import { login } from '@/lib/api/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('demo@reputation.local')
  const [password, setPassword] = useState('demo123')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
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
    <div className="relative min-h-screen overflow-hidden bg-[#020711] text-white before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-[520px] before:bg-[linear-gradient(180deg,transparent,rgba(2,7,17,0.30)_18%,#020711_72%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_18%_42%,rgba(139,92,246,0.18),transparent_32%),radial-gradient(circle_at_84%_36%,rgba(16,185,129,0.13),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[620px] bg-[radial-gradient(ellipse_at_bottom,rgba(34,211,238,0.22),rgba(15,23,42,0.18)_34%,transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-[-130px] left-0 right-0 h-[520px] opacity-45 [background-image:linear-gradient(rgba(34,211,238,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.12)_1px,transparent_1px)] [background-size:34px_34px] [transform:perspective(620px)_rotateX(62deg)_translateY(40px)]" />

      <main className="relative z-10 flex min-h-screen flex-col items-center px-5 pb-32 pt-10 sm:pb-24 sm:pt-20">
        <section className="mb-8 flex flex-col items-center text-center">
          <div className="relative flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
            <div className="absolute inset-0 rounded-[32px] bg-cyan-400/10 blur-2xl" />
            <div className="absolute h-[118px] w-[118px] rounded-full border border-cyan-300/20 animate-[spin_14s_linear_infinite]" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] border border-cyan-300/35 bg-[linear-gradient(135deg,rgba(34,211,238,0.32),rgba(139,92,246,0.38))] shadow-[0_0_48px_rgba(34,211,238,0.34)]">
              <span className="text-[38px] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.45)]">R</span>
            </div>
          </div>

          <div className="mt-6 max-w-full text-center text-[21px] font-semibold uppercase tracking-[0.30em] text-white sm:text-[34px] sm:tracking-[0.42em]">
            Reputation OS
          </div>
          <div className="mx-auto mt-3 max-w-[320px] text-center text-sm leading-6 text-slate-400 sm:max-w-md sm:text-base">
            Управляйте репутацией, реагируйте быстрее и принимайте решения на основе сигналов.
          </div>
        </section>

        <section className="w-full max-w-[640px] overflow-hidden rounded-[34px] border border-cyan-300/20 bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.03),0_28px_110px_rgba(0,0,0,0.58),0_0_80px_rgba(34,211,238,0.18)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-0" />

          <div className="relative">
            <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/75">Reputation OS</div>
            <h1 className="mt-4 text-[38px] font-semibold leading-none tracking-[-0.055em] text-white">Вход</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Войдите в рабочее пространство Reputation Inbox.
            </p>

            <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-4 shadow-[0_0_34px_rgba(34,211,238,0.08)]">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-violet-300/30 bg-violet-500/20 text-violet-100 shadow-[0_0_34px_rgba(139,92,246,0.26)]">
                  <ShieldCheck className="h-8 w-8" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-base font-semibold text-white">Единый центр репутации</div>
                    <div className="hidden items-center gap-2 text-xs text-emerald-300 sm:flex">
                      <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
                      Онлайн
                    </div>
                  </div>
                  <div className="mt-1 text-sm leading-5 text-slate-400">
                    Мониторинг отзывов, рисков и аналитики в одном месте.
                  </div>
                </div>

                <div className="hidden h-14 w-24 items-end justify-end gap-1 sm:flex">
                  {[10, 18, 28, 42, 56].map((height, index) => (
                    <span
                      key={index}
                      className="w-2 rounded-full bg-gradient-to-t from-cyan-500/50 to-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.45)]"
                      style={{ height }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="group flex h-16 items-center gap-3 rounded-[20px] border border-white/10 bg-[#0b1422]/80 px-4 transition focus-within:border-cyan-300/35 focus-within:bg-cyan-500/[0.06]">
                <Mail className="h-5 w-5 shrink-0 text-slate-400 group-focus-within:text-cyan-200" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                />
              </label>

              <label className="group flex h-16 items-center gap-3 rounded-[20px] border border-white/10 bg-[#0b1422]/80 px-4 transition focus-within:border-cyan-300/35 focus-within:bg-cyan-500/[0.06]">
                <Lock className="h-5 w-5 shrink-0 text-slate-400 group-focus-within:text-cyan-200" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль"
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </label>

              <div className="rounded-[20px] border border-white/10 bg-[#0b1422]/80 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-3 text-sm font-semibold text-white">
                    <MonitorCheck className="h-5 w-5 text-slate-400" />
                    Демо-доступ
                  </div>
                  <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    готов
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                  <div>Email: <span className="text-cyan-200">demo@reputation.local</span></div>
                  <div>Пароль: <span className="text-cyan-200">demo123</span></div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setRemember((value) => !value)}
                  className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${remember ? 'border-cyan-300 bg-cyan-400 text-slate-950' : 'border-white/15 bg-white/5 text-transparent'}`}>
                    ✓
                  </span>
                  Запомнить меня
                </button>

                <button type="button" className="text-sm font-medium text-cyan-300 transition hover:text-cyan-100">
                  Забыли пароль?
                </button>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="group flex h-16 w-full items-center justify-center gap-3 rounded-[20px] bg-[linear-gradient(90deg,#22d3ee,#3b82f6,#8b5cf6)] text-base font-semibold text-white shadow-[0_0_38px_rgba(34,211,238,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Вход...' : 'Войти'}
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              Нет аккаунта? <a href="/register" className="font-medium text-cyan-300 transition hover:text-cyan-100">Зарегистрироваться</a>
            </div>
          </div>
        </section>

        <section className="mt-10 grid w-full max-w-[760px] grid-cols-3 gap-3 text-center">
          {[
            { icon: Waves, title: 'Мониторинг 24/7', text: 'Следим за упоминаниями' },
            { icon: Zap, title: 'ИИ-аналитика', text: 'Находим риски и тренды' },
            { icon: Activity, title: 'Быстрые действия', text: 'Реагируйте вовремя' }
          ].map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_30px_rgba(139,92,246,0.06)]">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-500/15 text-violet-100">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-3 text-sm font-semibold text-white">{feature.title}</div>
                <div className="mt-1 hidden text-xs leading-5 text-slate-400 sm:block">{feature.text}</div>
              </div>
            )
          })}
        </section>
      </main>
    </div>
  )
}
