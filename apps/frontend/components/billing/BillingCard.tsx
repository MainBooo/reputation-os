'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import { getBillingPlans, type BillingPlan } from '@/lib/api/billing'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'

// ─── Helpers ───────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  YANDEX: 'Яндекс Карты',
  TWO_GIS: '2ГИС',
}

function formatPrice(price: number) {
  return price.toLocaleString('ru-RU') + ' ₽/мес'
}

function UsageBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const unlimited = max === -1
  const pct = unlimited ? 0 : Math.min(100, Math.round((value / max) * 100))
  const danger = pct >= 90

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={danger ? 'text-red-300' : 'text-zinc-300'}>
          {unlimited ? `${value} / ∞` : `${value} / ${max}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className={`h-full rounded-full transition-all ${danger ? 'bg-red-400/70' : 'bg-cyan-400/60'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function FeatureRow({
  label,
  value,
  active,
}: {
  label: string
  value?: string
  active: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className={`text-sm font-medium ${active ? 'text-cyan-100' : 'text-zinc-600'}`}>
        {value ?? (active ? 'Включено' : 'Недоступно')}
      </span>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function BillingCard() {
  const router = useRouter()
  const { entitlements, loading: entitlementsLoading } = useSubscription()
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const loading = entitlementsLoading || plansLoading

  useEffect(() => {
    getBillingPlans()
      .then((pl) => setPlans(Array.isArray(pl) ? pl : []))
      .finally(() => setPlansLoading(false))
  }, [])

  const currentPlan = plans.find((p) => p.code === entitlements?.planCode)
  const nextPlan = plans.find((p) => p.priceMonthly > (currentPlan?.priceMonthly ?? -1))

  return (
    <Card className="overflow-hidden p-0">
      {/* Header */}
      <div className="relative border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-5">
        <div className="text-lg font-semibold text-white">Тариф и подписка</div>
        <div className="mt-1 text-sm text-zinc-300">
          Управляйте подпиской и лимитами вашего workspace.
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-[1.35rem] bg-white/[0.04]" />
            <div className="h-12 animate-pulse rounded-[1.35rem] bg-white/[0.04]" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current plan */}
            <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/10 bg-[#0b1220]/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">
                  {entitlements?.planName ?? 'Бесплатный'}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">Текущий тариф</div>
              </div>
              {currentPlan && currentPlan.priceMonthly > 0 ? (
                <div className="rounded-full border border-cyan-300/20 bg-cyan-400/[0.08] px-3 py-1 text-xs font-medium text-cyan-100">
                  {formatPrice(currentPlan.priceMonthly)}
                </div>
              ) : (
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-400">
                  Бесплатно
                </div>
              )}
            </div>

            {/* Usage */}
            {entitlements && (
              <div className="space-y-3 rounded-[1.35rem] border border-white/10 bg-[#050816]/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Использование
                </div>
                <UsageBar
                  label="Компании"
                  value={entitlements.usage.companiesCount}
                  max={entitlements.effective.maxCompanies}
                />
                <UsageBar
                  label="AI-ответы в этом месяце"
                  value={entitlements.usage.aiRepliesThisMonth}
                  max={entitlements.effective.maxAiRepliesPerMonth}
                />
              </div>
            )}

            {/* Features */}
            {entitlements && (
              <div className="rounded-[1.35rem] border border-white/10 bg-[#050816]/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Возможности тарифа
                </div>
                <div className="space-y-2">
                  <FeatureRow
                    label="Платформы"
                    value={entitlements.effective.platforms
                      .map((p) => PLATFORM_LABELS[p] ?? p)
                      .join(', ')}
                    active={entitlements.effective.platforms.length > 0}
                  />
                  <FeatureRow
                    label="Telegram-уведомления"
                    active={entitlements.effective.telegramNotifications}
                  />
                  <FeatureRow
                    label="Расширенная аналитика"
                    active={entitlements.effective.advancedAnalytics}
                  />
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  nextPlan ? `/billing/checkout?plan=${nextPlan.code}` : '/billing/checkout',
                )
              }
              className="h-11 w-full rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-6 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),0_10px_30px_rgba(168,85,247,0.10),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:border-cyan-200/35 hover:brightness-110"
            >
              {nextPlan ? `Перейти на ${nextPlan.name}` : 'Управление подпиской'}
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
