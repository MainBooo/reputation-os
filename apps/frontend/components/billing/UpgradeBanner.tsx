'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'
import { isSubscriptionActive, getTrialDaysLeft } from '@/lib/api/billing'

export default function UpgradeBanner() {
  const { entitlements, loading } = useSubscription()

  if (loading) return null

  if (entitlements?.subscriptionStatus === 'TRIAL') {
    const days = getTrialDaysLeft(entitlements)
    const daysLabel =
      days === null ? '' :
      days === 0 ? ' — истекает сегодня' :
      days === 1 ? ' — остался 1 день' :
      ` — осталось ${days} дн.`

    return (
      <div className="mb-6 overflow-hidden rounded-[24px] border border-cyan-400/20 bg-[radial-gradient(circle_at_0%_50%,rgba(34,211,238,0.06),transparent_50%),#0b111c] p-5 shadow-[0_0_40px_rgba(34,211,238,0.06)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-cyan-400/25 bg-cyan-500/10 text-cyan-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-white">
                Пробный период тарифа «Бизнес»{daysLabel}
              </div>
              <div className="mt-1 text-sm leading-6 text-zinc-400">
                Все функции открыты бесплатно. После окончания триала для продолжения работы потребуется активный тариф.
              </div>
            </div>
          </div>
          <Link
            href="/billing/checkout"
            className="shrink-0 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110 whitespace-nowrap"
          >
            Подключить тариф
          </Link>
        </div>
      </div>
    )
  }

  if (isSubscriptionActive(entitlements)) return null

  return (
    <div className="mb-6 overflow-hidden rounded-[24px] border border-amber-400/20 bg-[radial-gradient(circle_at_0%_50%,rgba(251,191,36,0.08),transparent_50%),#0b111c] p-5 shadow-[0_0_40px_rgba(251,191,36,0.06)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-amber-400/25 bg-amber-500/10 text-amber-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-white">
              Активируйте тариф, чтобы включить мониторинг отзывов
            </div>
            <div className="mt-1 text-sm leading-6 text-zinc-400">
              Без активного тарифа доступен просмотр кабинета, но синхронизация источников, AI-ответы, уведомления и расширенная аналитика недоступны.
            </div>
          </div>
        </div>
        <Link
          href="/billing/checkout"
          className="shrink-0 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110 whitespace-nowrap"
        >
          Выбрать тариф
        </Link>
      </div>
    </div>
  )
}
