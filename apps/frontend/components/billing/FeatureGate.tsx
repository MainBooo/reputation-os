'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMyEntitlements, type BillingEntitlements } from '@/lib/api/billing'

export type FeatureKey =
  | 'telegramNotifications'
  | 'advancedAnalytics'
  | 'maxCompanies'
  | 'maxAiRepliesPerMonth'

const FEATURE_NAMES: Record<FeatureKey, string> = {
  telegramNotifications: 'Telegram-уведомления',
  advancedAnalytics: 'Расширенная аналитика',
  maxCompanies: 'Управление несколькими компаниями',
  maxAiRepliesPerMonth: 'AI-ответы на отзывы',
}

function hasFeature(ent: BillingEntitlements, feature: FeatureKey): boolean {
  const val = ent.effective[feature as keyof typeof ent.effective]
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val > 0 || val === -1
  if (Array.isArray(val)) return val.length > 0
  return Boolean(val)
}

function DefaultUpsell({ feature }: { feature: FeatureKey }) {
  const router = useRouter()
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-[#050816]/50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">
            🔒 {FEATURE_NAMES[feature]}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Эта функция доступна на более высоком тарифе.
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/billing/checkout')}
          className="shrink-0 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110"
        >
          Улучшить тариф
        </button>
      </div>
    </div>
  )
}

interface FeatureGateProps {
  feature: FeatureKey
  entitlements?: BillingEntitlements | null
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function FeatureGate({
  feature,
  entitlements: entitlementsProp,
  children,
  fallback,
}: FeatureGateProps) {
  const [entitlements, setEntitlements] = useState<BillingEntitlements | null>(
    entitlementsProp ?? null,
  )
  const [loading, setLoading] = useState(entitlementsProp === undefined)

  useEffect(() => {
    if (entitlementsProp !== undefined) {
      setEntitlements(entitlementsProp)
      return
    }
    getMyEntitlements()
      .then(setEntitlements)
      .finally(() => setLoading(false))
  }, [entitlementsProp])

  if (loading) {
    return <div className="h-16 animate-pulse rounded-[1.35rem] bg-white/[0.04]" />
  }

  if (!entitlements || !hasFeature(entitlements, feature)) {
    return <>{fallback ?? <DefaultUpsell feature={feature} />}</>
  }

  return <>{children}</>
}
