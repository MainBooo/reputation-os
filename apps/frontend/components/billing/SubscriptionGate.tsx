'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'
import { isSubscriptionActive, type BillingEntitlements } from '@/lib/api/billing'
import SubscriptionRequiredModal from './SubscriptionRequiredModal'

export type GateFeatureKey =
  | 'ADD_COMPANY'
  | 'SYNC_REVIEWS'
  | 'WEB_MONITORING'
  | 'AI_REPLIES'
  | 'TELEGRAM_NOTIFICATIONS'
  | 'PUSH_NOTIFICATIONS'
  | 'ADVANCED_ANALYTICS'
  | 'EXPORTS'

const FEATURE_LABELS: Record<GateFeatureKey, string> = {
  ADD_COMPANY: 'Добавление компании',
  SYNC_REVIEWS: 'Синхронизация отзывов',
  WEB_MONITORING: 'WEB-мониторинг',
  AI_REPLIES: 'AI-ответы на отзывы',
  TELEGRAM_NOTIFICATIONS: 'Telegram-уведомления',
  PUSH_NOTIFICATIONS: 'Push-уведомления',
  ADVANCED_ANALYTICS: 'Расширенная аналитика',
  EXPORTS: 'Экспорт данных',
}

const FEATURE_DESCRIPTIONS: Record<GateFeatureKey, string> = {
  ADD_COMPANY: 'Подключите тариф, чтобы добавлять компании и настраивать мониторинг.',
  SYNC_REVIEWS: 'Подключите тариф, чтобы синхронизировать отзывы из источников.',
  WEB_MONITORING: 'WEB-мониторинг доступен на тарифах Бизнес и Агентство.',
  AI_REPLIES: 'Подключите тариф, чтобы использовать AI-ответы на отзывы.',
  TELEGRAM_NOTIFICATIONS: 'Telegram-уведомления доступны на тарифах Бизнес и Агентство.',
  PUSH_NOTIFICATIONS: 'Push-уведомления доступны на тарифе Старт и выше.',
  ADVANCED_ANALYTICS: 'Расширенная аналитика доступна на тарифах Бизнес и Агентство.',
  EXPORTS: 'Экспорт данных доступен на платных тарифах.',
}

function checkFeature(ent: BillingEntitlements, feature: GateFeatureKey): boolean {
  if (!isSubscriptionActive(ent)) return false
  const e = ent.effective
  switch (feature) {
    case 'ADD_COMPANY':
      return e.maxCompanies === -1 || e.maxCompanies > 0
    case 'SYNC_REVIEWS':
      return isSubscriptionActive(ent)
    case 'WEB_MONITORING':
      return Boolean(e.webMonitoringEnabled)
    case 'AI_REPLIES':
      return e.maxAiRepliesPerMonth === -1 || e.maxAiRepliesPerMonth > 0
    case 'TELEGRAM_NOTIFICATIONS':
      return Boolean(e.telegramNotifications)
    case 'PUSH_NOTIFICATIONS':
      return Boolean(e.pushNotificationsEnabled)
    case 'ADVANCED_ANALYTICS':
      return Boolean(e.advancedAnalytics)
    case 'EXPORTS':
      return isSubscriptionActive(ent)
    default:
      return false
  }
}

interface LockedStateProps {
  feature: GateFeatureKey
  inline?: boolean
}

function LockedState({ feature, inline = false }: LockedStateProps) {
  const router = useRouter()

  if (inline) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Lock className="h-4 w-4 shrink-0" />
        <span>Доступно после подключения тарифа</span>
        <button
          type="button"
          onClick={() => router.push('/billing/checkout')}
          className="ml-1 font-medium text-cyan-400 underline-offset-2 hover:underline"
        >
          Выбрать тариф
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-[#050816]/50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Lock className="h-4 w-4 text-zinc-400" />
            {FEATURE_LABELS[feature]}
          </div>
          <div className="mt-1 text-xs text-zinc-500">{FEATURE_DESCRIPTIONS[feature]}</div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/billing/checkout')}
          className="shrink-0 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110"
        >
          Выбрать тариф
        </button>
      </div>
    </div>
  )
}

interface SubscriptionGateProps {
  feature: GateFeatureKey
  children: React.ReactNode
  /** показывает inline locked-текст вместо полного блока */
  inline?: boolean
  /** кастомный fallback вместо дефолтного */
  fallback?: React.ReactNode
  /** вместо locked-блока открывает modal при клике на children-обёртку */
  asModal?: boolean
}

export default function SubscriptionGate({
  feature,
  children,
  inline = false,
  fallback,
  asModal = false,
}: SubscriptionGateProps) {
  const { entitlements, loading } = useSubscription()
  const [modalOpen, setModalOpen] = useState(false)

  if (loading) {
    return <div className="h-12 animate-pulse rounded-[1.35rem] bg-white/[0.04]" />
  }

  const allowed = entitlements ? checkFeature(entitlements, feature) : false

  if (allowed) return <>{children}</>

  if (asModal) {
    return (
      <>
        <div onClick={() => setModalOpen(true)} className="cursor-pointer">
          {children}
        </div>
        <SubscriptionRequiredModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`${FEATURE_LABELS[feature]} — требуется тариф`}
          description={FEATURE_DESCRIPTIONS[feature]}
        />
      </>
    )
  }

  if (fallback) return <>{fallback}</>

  return <LockedState feature={feature} inline={inline} />
}
