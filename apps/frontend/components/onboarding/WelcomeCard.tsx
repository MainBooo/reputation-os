'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight } from 'lucide-react'
import { markWelcomeSeen } from '@/lib/api/onboarding'

interface WelcomeCardProps {
  initialWelcomeSeen: boolean
}

export default function WelcomeCard({ initialWelcomeSeen }: WelcomeCardProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(!initialWelcomeSeen)
  const [loading, setLoading] = useState(false)

  if (!visible) return null

  async function handleStart() {
    if (loading) return
    setLoading(true)
    try {
      await markWelcomeSeen()
    } catch {}
    setVisible(false)
    router.push('/companies')
  }

  return (
    <div className="animate-fade-slide-up mb-5 overflow-hidden rounded-[30px] border border-cyan-400/25 bg-[radial-gradient(ellipse_at_0%_0%,rgba(99,102,241,0.22),transparent_40%),radial-gradient(ellipse_at_100%_100%,rgba(34,211,238,0.16),transparent_42%),#080e1b] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.38),0_0_54px_rgba(34,211,238,0.10),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-200">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Business Trial активирован
            </span>
          </div>

          <h2 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[28px]">
            Ваш Business Trial уже активирован
          </h2>

          <p className="mt-2.5 max-w-xl text-base leading-7 text-slate-400">
            7&nbsp;дней полного доступа уже доступны. Настройте мониторинг один раз&nbsp;— дальше
            ReputationOS будет автоматически отслеживать новые отзывы и упоминания.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Обычно настройка занимает меньше минуты.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={handleStart}
            disabled={loading}
            className="group inline-flex items-center gap-3 rounded-[22px] border border-cyan-400/40 bg-cyan-500/[0.18] px-6 py-3.5 text-sm font-semibold text-cyan-100 shadow-[0_0_36px_rgba(34,211,238,0.22)] transition-all duration-200 hover:border-cyan-300/60 hover:bg-cyan-500/[0.28] hover:shadow-[0_0_48px_rgba(34,211,238,0.32)] active:scale-[0.97] disabled:opacity-60"
          >
            {loading ? (
              <span className="animate-pulse-soft">Загрузка...</span>
            ) : (
              <>
                Настроить мониторинг
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
