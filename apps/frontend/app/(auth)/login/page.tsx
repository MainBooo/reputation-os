'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Star,
  Zap
} from 'lucide-react'
import { login } from '@/lib/api/auth'

const features = [
  { icon: MessageSquareText, title: 'Inbox отзывов', text: 'Все отзывы и упоминания в одном месте' },
  { icon: Zap, title: 'AI-аналитика', text: 'Анализ настроений и выявление рисков на основе ИИ' },
  { icon: ShieldCheck, title: 'Мониторинг 24/7', text: 'Контроль репутации в реальном времени' },
  { icon: Star, title: 'White-label', text: 'Брендируйте систему под свой бизнес' }
]

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
      if (document.cookie.includes('accessToken=')) router.replace('/dashboard')
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
    <div className="relative min-h-screen overflow-hidden bg-[#02030b] px-4 py-4 text-white sm:px-6 lg:flex lg:items-center lg:justify-center lg:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.20),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(217,70,239,0.14),transparent_36%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.18),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(2,6,23,0.30),rgba(2,3,11,0.94)_62%)]" />
      <div className="pointer-events-none absolute bottom-[-44px] left-[-12%] right-[-12%] h-[330px] opacity-90">
        <svg className="h-full w-full" viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="loginWaveA" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#d946ef" stopOpacity="0.95" />
              <stop offset="46%" stopColor="#06b6d4" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="loginWaveB" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.65" />
              <stop offset="52%" stopColor="#38bdf8" stopOpacity="0.80" />
              <stop offset="100%" stopColor="#d946ef" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path d="M0 178 C180 84 302 285 492 180 C650 92 798 124 962 198 C1164 290 1296 150 1440 194" fill="none" stroke="url(#loginWaveA)" strokeWidth="3" />
          <path d="M0 230 C220 126 356 286 548 214 C710 154 844 118 1026 206 C1210 292 1302 224 1440 162" fill="none" stroke="url(#loginWaveB)" strokeWidth="2" />
          <path d="M0 200 C230 116 390 270 600 206 C790 150 940 172 1120 246 C1260 304 1360 236 1440 210 L1440 360 L0 360 Z" fill="rgba(14,165,233,0.08)" />
        </svg>
      </div>
      <div className="pointer-events-none absolute bottom-[-90px] left-[-10%] right-[-10%] h-[310px] opacity-35 [background-image:radial-gradient(circle,rgba(56,189,248,0.50)_1px,transparent_1.8px)] [background-size:18px_18px] [transform:perspective(720px)_rotateX(58deg)]" />

      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0.6px,transparent_0.7px)] [background-size:4px_4px]" />

      <main className="relative z-10 mx-auto grid w-full max-w-[1280px] overflow-hidden rounded-[34px] border border-fuchsia-400/35 bg-[#050816]/78 shadow-[0_32px_120px_rgba(0,0,0,0.72),0_0_46px_rgba(56,189,248,0.22),0_0_72px_rgba(217,70,239,0.20),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-0 before:rounded-[34px] before:border before:border-blue-300/30 before:[mask-image:linear-gradient(135deg,#000,transparent_42%,#000)] lg:min-h-[720px] lg:grid-cols-[1.25fr_0.95fr]">
        <section className="relative flex flex-col items-center justify-center px-5 py-9 text-center sm:px-10 lg:px-14 lg:py-14">
          <div className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
            <div className="absolute inset-0 rounded-full bg-fuchsia-500/20 blur-2xl" />
            <div className="absolute h-[106px] w-[106px] rounded-full border border-blue-400/35 shadow-[0_0_30px_rgba(59,130,246,0.34),0_0_46px_rgba(217,70,239,0.22)] sm:h-[124px] sm:w-[124px]" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-[24px] border border-blue-300/45 bg-[linear-gradient(135deg,rgba(37,99,235,0.36),rgba(147,51,234,0.50))] shadow-[0_0_28px_rgba(59,130,246,0.58),0_0_48px_rgba(217,70,239,0.40)] sm:h-20 sm:w-20 sm:rounded-[28px]">
              <span className="text-[32px] font-black leading-none text-white sm:text-[42px]">R</span>
            </div>
          </div>

          <div className="mt-7 text-[24px] font-semibold uppercase tracking-[0.24em] text-white drop-shadow-[0_0_24px_rgba(139,92,246,0.35)] sm:text-[36px] sm:tracking-[0.36em]">
            Reputation OS
          </div>

          <p className="mt-4 max-w-[520px] text-sm leading-6 text-slate-300 sm:text-base">
            Управляйте репутацией, реагируйте быстрее и принимайте решения на основе сигналов.
          </p>

          <div className="mt-8 hidden w-full max-w-[680px] grid-cols-2 gap-3 text-center sm:grid-cols-4 lg:grid">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="rounded-[22px] border border-violet-300/20 bg-white/[0.045] p-3 shadow-[0_0_40px_rgba(59,130,246,0.12)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_0_54px_rgba(56,189,248,0.18)]">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/10 text-blue-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-xs font-semibold text-white sm:text-sm">{feature.title}</div>
                  <div className="mt-1 hidden text-xs leading-4 text-slate-400 sm:block">{feature.text}</div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="relative flex items-center justify-center px-5 pb-7 sm:px-10 lg:px-14 lg:py-14">
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-[32px] border border-fuchsia-300/25 bg-[#08091a]/62 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_24px_90px_rgba(0,0,0,0.62),0_0_58px_rgba(59,130,246,0.34),0_0_76px_rgba(217,70,239,0.20),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(217,70,239,0.22),transparent_38%),radial-gradient(circle_at_100%_0%,rgba(37,99,235,0.22),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_38%)]" />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />
            <div className="pointer-events-none absolute inset-y-8 right-0 w-px bg-gradient-to-b from-transparent via-cyan-300/60 to-transparent" />
            <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-300/70 to-transparent" />

            <div className="relative">
              <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-white sm:text-[34px]">Вход в систему</h1>
              <p className="mt-3 max-w-[320px] text-sm leading-6 text-slate-400">
                Войдите в рабочее пространство Reputation Inbox.
              </p>

              <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
                <label className="group flex h-14 items-center gap-3 rounded-2xl border border-blue-300/25 bg-[#050817]/72 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_22px_rgba(59,130,246,0.08)] transition focus-within:border-fuchsia-300/55 focus-within:bg-fuchsia-500/[0.06] focus-within:shadow-[0_0_28px_rgba(217,70,239,0.18)]">
                  <Mail className="h-5 w-5 shrink-0 text-slate-400 group-focus-within:text-blue-100" />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    autoComplete="email"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 sm:text-base"
                  />
                </label>

                <label className="group flex h-14 items-center gap-3 rounded-2xl border border-blue-300/25 bg-[#050817]/72 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_22px_rgba(59,130,246,0.08)] transition focus-within:border-fuchsia-300/55 focus-within:bg-fuchsia-500/[0.06] focus-within:shadow-[0_0_28px_rgba(217,70,239,0.18)]">
                  <Lock className="h-5 w-5 shrink-0 text-slate-400 group-focus-within:text-blue-100" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль"
                    autoComplete="current-password"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 sm:text-base"
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

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setRemember((value) => !value)}
                    className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${remember ? 'border-blue-300 bg-blue-500 text-white' : 'border-white/15 bg-white/5 text-transparent'}`}>
                      ✓
                    </span>
                    Запомнить меня
                  </button>

                  <button type="button" className="text-sm font-medium text-blue-300 transition hover:text-fuchsia-100">
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
                  className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-cyan-200/30 bg-[linear-gradient(90deg,#0ea5e9,#2563eb,#9333ea,#d946ef)] text-base font-semibold text-white shadow-[0_0_34px_rgba(14,165,233,0.42),0_0_62px_rgba(217,70,239,0.32),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Вход...' : 'Войти'}
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </button>
              </form>

              <div className="mt-5 text-center text-sm text-slate-400">
                Нет аккаунта? <a href="/register" className="font-medium text-blue-300 transition hover:text-fuchsia-100">Зарегистрироваться</a>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3 text-center lg:hidden">
                {features.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <div key={`mobile-${feature.title}`} className="rounded-[22px] border border-violet-300/20 bg-white/[0.045] p-3 shadow-[0_0_34px_rgba(59,130,246,0.12)] backdrop-blur-xl">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/10 text-blue-100">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-2 text-[13px] font-semibold leading-4 text-white">{feature.title}</div>
                      <div className="mt-1 text-[11px] leading-4 text-slate-400">{feature.text}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
