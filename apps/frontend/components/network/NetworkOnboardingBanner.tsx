'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe2, Send, X } from 'lucide-react'
import { getCompanySourceTargets, getCompanyWebSourcesOverview } from '@/lib/api/companies'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'

const DISMISS_KEY_PREFIX = 'network_onboarding_dismissed_'

// Ненавязчивый nudge на карточке компании: тариф уже даёт доступ к WEB/Telegram
// мониторингу, но пользователь ещё не включил их для ЭТОЙ компании (типичный
// случай — подключили Яндекс/2ГИС при создании компании, купили Business, и не
// заметили, что WEB/Telegram остаются opt-in). Не меняет архитектуру
// opt-in — просто указывает на существующий хаб «Сеть», где это включается.
export default function NetworkOnboardingBanner({ companyId }: { companyId: string }) {
  const router = useRouter()
  const { entitlements } = useSubscription()
  const [dismissed, setDismissed] = useState(true)
  const [loading, setLoading] = useState(true)
  const [webEnabled, setWebEnabled] = useState(true)
  const [telegramEnabled, setTelegramEnabled] = useState(true)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY_PREFIX + companyId) === '1')
    } catch {
      setDismissed(false)
    }
  }, [companyId])

  useEffect(() => {
    let cancelled = false

    Promise.all([getCompanyWebSourcesOverview(companyId), getCompanySourceTargets(companyId)])
      .then(([webData, targets]: [any, any[]]) => {
        if (cancelled) return
        setWebEnabled(Boolean(webData?.status?.enabled))
        const tgTarget = Array.isArray(targets) ? targets.find((t) => t.source?.platform === 'TELEGRAM') : null
        setTelegramEnabled(Boolean(tgTarget && tgTarget.isActive !== false && tgTarget.syncMentionsEnabled !== false))
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [companyId])

  const webAvailable = Boolean(entitlements?.effective?.webMonitoringEnabled)
  const telegramAvailable = Boolean(entitlements?.effective?.telegramMonitoringEnabled)
  const webMissing = webAvailable && !webEnabled
  const telegramMissing = telegramAvailable && !telegramEnabled

  if (loading || dismissed || (!webMissing && !telegramMissing)) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY_PREFIX + companyId, '1')
    } catch {}
    setDismissed(true)
  }

  return (
    <div className="relative mb-4 overflow-hidden rounded-[24px] border border-cyan-400/20 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.14),transparent_40%),rgba(8,14,27,0.92)] p-4 shadow-[0_0_40px_rgba(34,211,238,0.08)] sm:p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="pr-8 text-sm font-semibold text-white">
        Дополнительные источники мониторинга ещё не включены
      </div>
      <div className="mt-1 max-w-xl text-xs leading-5 text-zinc-400">
        Ваш тариф уже даёт доступ к WEB и Telegram-мониторингу для этой компании — осталось включить их.
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        {webMissing ? (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Globe2 className="h-4 w-4 text-cyan-300" />
            WEB-мониторинг выключен
          </div>
        ) : null}
        {telegramMissing ? (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Send className="h-4 w-4 text-cyan-300" />
            Telegram-мониторинг выключен
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => router.push(`/companies/${companyId}/web`)}
        className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
      >
        Включить сейчас →
      </button>
    </div>
  )
}
