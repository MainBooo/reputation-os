'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, Check, Star } from 'lucide-react'
import Card from '@/components/ui/Card'
import {
  getBillingPlans,
  createCheckout,
  syncPendingPayments,
  getTrialDaysLeft,
  type BillingPlan,
} from '@/lib/api/billing'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'

// ─── Labels & formatters ───────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  YANDEX: 'Яндекс Карты',
  TWOGIS: '2ГИС',
  WEB: 'Веб-поиск',
}

function pluralMembers(n: number) {
  if (n === 1) return '1 участник'
  if (n >= 2 && n <= 4) return `${n} участника`
  return `${n} участников`
}

function pluralCompanies(n: number) {
  if (n === -1) return '∞ компаний'
  if (n === 1) return '1 компания'
  if (n >= 2 && n <= 4) return `${n} компании`
  return `${n} компаний`
}

function sourcesLabel(n: number | undefined): string {
  if (n == null || n === -1) return '∞ источников мониторинга'
  if (n >= 5 && n <= 20) return `${n} источников мониторинга`
  return `${n} источников мониторинга`
}

function aiLabel(n: number): string {
  if (n === -1) return 'Безлимит AI-ответов'
  return `${n} AI-ответов/мес`
}

function pricePerDay(
  priceMonthly: number,
  priceYearly: number | null | undefined,
  period: 'monthly' | 'yearly',
): string {
  const daily =
    period === 'yearly' && priceYearly ? priceYearly / 365 : priceMonthly / 30
  return `≈${Math.round(daily)} ₽ в день`
}

// ─── Feature groups ─────────────────────────────────────────────────────────

type FeatureItem = { label: string; highlight?: boolean }
type FeatureGroup = { label: string; items: FeatureItem[] }

function buildFeatureGroups(plan: BillingPlan): FeatureGroup[] {
  const groups: FeatureGroup[] = []

  // Мониторинг
  const monitoring: FeatureItem[] = [
    { label: pluralCompanies(plan.limits.maxCompanies) },
    { label: sourcesLabel(plan.limits.maxSources) },
    ...plan.limits.platforms.map((p) => ({ label: PLATFORM_LABELS[p] ?? p })),
  ]
  groups.push({ label: 'Мониторинг', items: monitoring })

  // AI
  groups.push({
    label: 'AI',
    items: [
      {
        label: aiLabel(plan.limits.maxAiRepliesPerMonth),
        highlight: plan.limits.maxAiRepliesPerMonth === -1,
      },
    ],
  })

  // Уведомления
  const notifications: FeatureItem[] = []
  if (plan.limits.pushNotificationsEnabled) {
    notifications.push({ label: 'Push-уведомления' })
  }
  if (plan.limits.telegramNotifications) {
    notifications.push({ label: 'Telegram-уведомления', highlight: true })
  }
  if (notifications.length > 0) {
    groups.push({ label: 'Уведомления', items: notifications })
  }

  // Команда
  const maxMembers = plan.limits.maxMembers ?? 0
  if (maxMembers > 0) {
    groups.push({ label: 'Команда', items: [{ label: pluralMembers(maxMembers) }] })
  }

  // Дополнительно
  const extra: FeatureItem[] = [
    {
      label: plan.limits.advancedAnalytics ? 'Расширенная аналитика' : 'Базовая аналитика',
      highlight: plan.limits.advancedAnalytics,
    },
  ]
  if (plan.limits.webMonitoringEnabled) {
    extra.push({ label: 'Мониторинг веб-упоминаний', highlight: true })
  }
  extra.push({ label: 'История отзывов и упоминаний' })
  if (plan.code === 'AGENCY') {
    extra.push({ label: 'Для агентств и сетевых компаний', highlight: true })
  }
  groups.push({ label: 'Дополнительно', items: extra })

  return groups
}

function buildSummaryFeatures(plan: BillingPlan): string[] {
  const f: string[] = []
  f.push(
    `${pluralCompanies(plan.limits.maxCompanies)}, ${sourcesLabel(plan.limits.maxSources)}`,
  )
  f.push(plan.limits.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', '))
  f.push(aiLabel(plan.limits.maxAiRepliesPerMonth))
  if (plan.limits.pushNotificationsEnabled) f.push('Push-уведомления')
  if (plan.limits.telegramNotifications) f.push('Telegram-уведомления')
  if (plan.limits.webMonitoringEnabled) f.push('Мониторинг веб-упоминаний')
  if (plan.limits.advancedAnalytics) f.push('Расширенная аналитика')
  if (plan.code === 'AGENCY') f.push('Для агентств и сетевых компаний')
  return f
}

// ─── PlanCard ───────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  selected,
  onSelect,
  isCurrent,
  period,
}: {
  plan: BillingPlan
  selected: boolean
  onSelect: () => void
  isCurrent?: boolean
  period: 'monthly' | 'yearly'
}) {
  const isPopular = plan.code === 'PRO'

  const priceLabel =
    period === 'yearly' && plan.priceYearly
      ? `${plan.priceYearly.toLocaleString('ru-RU')} ₽/год`
      : `${plan.priceMonthly.toLocaleString('ru-RU')} ₽/мес`

  const dayLabel = pricePerDay(plan.priceMonthly, plan.priceYearly, period)

  const savings =
    period === 'yearly' && plan.priceYearly
      ? Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)
      : null

  const groups = buildFeatureGroups(plan)

  let cardClass =
    'relative flex flex-col rounded-2xl border text-left transition-all w-full cursor-pointer '
  if (selected) {
    cardClass +=
      'border-cyan-300/40 bg-[linear-gradient(135deg,rgba(34,211,238,0.07),rgba(79,70,229,0.07))] shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_8px_32px_rgba(34,211,238,0.08)]'
  } else if (isPopular) {
    cardClass +=
      'border-amber-400/30 bg-[linear-gradient(160deg,rgba(245,158,11,0.05),rgba(15,10,25,0.5))] shadow-[0_4px_24px_rgba(245,158,11,0.07)] hover:border-amber-400/45 hover:bg-[linear-gradient(160deg,rgba(245,158,11,0.08),rgba(15,10,25,0.6))]'
  } else {
    cardClass +=
      'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
  }

  return (
    <button type="button" onClick={onSelect} className={cardClass}>
      {/* Popular badge strip */}
      {isPopular && (
        <div className="flex items-center justify-center gap-1.5 rounded-t-2xl bg-[linear-gradient(90deg,rgba(245,158,11,0.18),rgba(234,179,8,0.13))] py-1.5 text-[11px] font-semibold tracking-wide text-amber-300">
          <Star className="h-3 w-3 fill-amber-300" />
          Самый популярный
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        {/* Header */}
        <div>
          {isCurrent && (
            <span className="mb-1.5 inline-block rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-500">
              Текущий
            </span>
          )}
          <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            {plan.name}
          </div>
          <div className="mt-1 text-xl font-bold text-white">{priceLabel}</div>
          <div className="mt-0.5 text-[11px] text-zinc-600">{dayLabel}</div>
          {savings !== null && (
            <div className="mt-0.5 text-[11px] text-emerald-400/80">−{savings}% экономия</div>
          )}
        </div>

        <div className="h-px w-full bg-white/[0.06]" />

        {/* Feature groups */}
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                {group.label}
              </div>
              <ul className="space-y-1">
                {group.items.map((f, i) =>
                  f.highlight ? (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-300/90">
                      <Check className="mt-px h-3 w-3 shrink-0 text-emerald-400" />
                      <span>{f.label}</span>
                    </li>
                  ) : (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                      <span className="mt-px shrink-0 text-[8px] leading-3 text-cyan-400/50">◆</span>
                      <span>{f.label}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </button>
  )
}

// ─── Comparison Table ──────────────────────────────────────────────────────

function ComparisonTable({ plans }: { plans: BillingPlan[] }) {
  type Row = { label: string; getValue: (p: BillingPlan) => string }

  const rows: Row[] = [
    {
      label: 'Компании',
      getValue: (p) =>
        p.limits.maxCompanies === -1 ? '∞' : String(p.limits.maxCompanies),
    },
    {
      label: 'Источники',
      getValue: (p) => {
        const v = p.limits.maxSources
        if (v == null) return '—'
        return v === -1 ? '∞' : String(v)
      },
    },
    {
      label: 'AI/мес',
      getValue: (p) =>
        p.limits.maxAiRepliesPerMonth === -1 ? '∞' : String(p.limits.maxAiRepliesPerMonth),
    },
    { label: 'Push', getValue: (p) => (p.limits.pushNotificationsEnabled ? '✓' : '—') },
    { label: 'Telegram', getValue: (p) => (p.limits.telegramNotifications ? '✓' : '—') },
    { label: 'Веб', getValue: (p) => (p.limits.webMonitoringEnabled ? '✓' : '—') },
    { label: 'Аналитика', getValue: (p) => (p.limits.advancedAnalytics ? '✓' : '—') },
    {
      label: 'Участники',
      getValue: (p) => (p.limits.maxMembers ? String(p.limits.maxMembers) : '—'),
    },
  ]

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th className="w-[28%] py-2.5 pl-3 text-left font-medium text-zinc-600 sm:pl-4">
              Параметр
            </th>
            {plans.map((p) => (
              <th
                key={p.code}
                className="w-[24%] px-1 py-2.5 text-center font-semibold text-zinc-400 sm:px-2"
              >
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.label}
              className={ri % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}
            >
              <td className="py-2 pl-3 text-zinc-500 sm:pl-4">{row.label}</td>
              {plans.map((p) => {
                const val = row.getValue(p)
                const isGood = val === '✓' || val === '∞'
                const isBad = val === '—'
                return (
                  <td
                    key={p.code}
                    className={`px-1 py-2 text-center font-medium sm:px-2 ${
                      isGood
                        ? 'text-emerald-400'
                        : isBad
                          ? 'text-zinc-700'
                          : 'text-zinc-300'
                    }`}
                  >
                    {val}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

function CheckoutInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPlan = searchParams.get('plan') ?? ''
  const { entitlements } = useSubscription()

  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [selectedCode, setSelectedCode] = useState(initialPlan)
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [step, setStep] = useState<'select' | 'success' | 'error'>('select')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    syncPendingPayments().catch(() => {})
    getBillingPlans()
      .then((data) => {
        const paid = (Array.isArray(data) ? data : []).filter((p) => p.priceMonthly > 0)
        setPlans(paid)
        if (!initialPlan && paid[0]) setSelectedCode(paid[0].code)
      })
      .finally(() => setLoading(false))
  }, [initialPlan])

  const selected = plans.find((p) => p.code === selectedCode)

  async function handleCheckout() {
    if (!selectedCode || processing) return
    setProcessing(true)
    setErrorMsg('')
    try {
      const result = await createCheckout(selectedCode, period)
      if (result?.confirmationUrl?.startsWith('http')) {
        window.location.href = result.confirmationUrl
        return
      }
      setStep('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось создать платёж.')
      setStep('error')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/[0.10] text-2xl text-emerald-100">
            ✓
          </div>
          <div className="text-xl font-semibold text-white">Подписка активирована</div>
          <div className="mt-2 text-sm text-zinc-400">
            Тариф{' '}
            <span className="font-medium text-cyan-100">{selected?.name ?? selectedCode}</span>{' '}
            успешно подключён.
          </div>
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="mt-6 h-11 w-full rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-6 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110"
          >
            Перейти в настройки
          </button>
        </Card>
      </div>
    )
  }

  const isTrialActive = entitlements?.subscriptionStatus === 'TRIAL'
  const trialDays = getTrialDaysLeft(entitlements ?? null)
  const summaryFeatures = selected ? buildSummaryFeatures(selected) : []

  const selectedPriceLabel =
    period === 'yearly' && selected?.priceYearly
      ? `${selected.priceYearly.toLocaleString('ru-RU')} ₽/год`
      : selected
        ? `${selected.priceMonthly.toLocaleString('ru-RU')} ₽/мес`
        : '—'

  const altPriceHint =
    period === 'monthly' && selected?.priceYearly
      ? `или ${selected.priceYearly.toLocaleString('ru-RU')} ₽/год — экономия ${(selected.priceMonthly * 12 - selected.priceYearly).toLocaleString('ru-RU')} ₽`
      : period === 'yearly' && selected
        ? `или ${selected.priceMonthly.toLocaleString('ru-RU')} ₽/мес`
        : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="text-2xl font-bold text-white">Выбор тарифа</div>

        {/* Period toggle */}
        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs">
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              period === 'monthly' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Месяц
          </button>
          <button
            type="button"
            onClick={() => setPeriod('yearly')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              period === 'yearly' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Год <span className="text-emerald-400/80">−17%</span>
          </button>
        </div>
      </div>

      <div className="mb-5 text-xs text-zinc-500">
        Безопасная оплата через ЮKassa · 7 дней бесплатного доступа к тарифу Бизнес при регистрации
      </div>

      {/* Trial banner */}
      {isTrialActive && (
        <div className="mb-5 rounded-[20px] border border-cyan-400/20 bg-cyan-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <div>
              <div className="text-sm font-semibold text-cyan-100">
                Пробный период активен
                {trialDays !== null &&
                  (trialDays === 0
                    ? ' — истекает сегодня'
                    : trialDays === 1
                      ? ' — остался 1 день'
                      : ` — осталось ${trialDays} дн.`)}
              </div>
              <div className="mt-0.5 text-xs text-zinc-400">
                Подключите тариф сейчас, чтобы продолжить работу без перерыва.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan cards — 1 column mobile, 3 columns tablet+ */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.code}
            plan={plan}
            selected={selectedCode === plan.code}
            onSelect={() => setSelectedCode(plan.code)}
            isCurrent={entitlements?.planCode === plan.code}
            period={period}
          />
        ))}
      </div>

      {/* Comparison table */}
      {plans.length > 0 && <ComparisonTable plans={plans} />}

      {/* Selected plan summary + checkout */}
      <Card className="mt-6 p-5">
        {selected ? (
          <>
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-widest text-zinc-600">
                Вы выбрали
              </div>
              <div className="mt-0.5 text-xl font-bold text-white">{selected.name}</div>
            </div>

            <ul className="mb-5 space-y-2">
              {summaryFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mb-5 border-t border-white/[0.06] pt-4">
              <div className="text-[11px] uppercase tracking-widest text-zinc-600">Итого</div>
              <div className="mt-1 text-2xl font-bold text-white">{selectedPriceLabel}</div>
              <div className="text-xs text-zinc-600">
                {pricePerDay(selected.priceMonthly, selected.priceYearly, period)}
              </div>
              {altPriceHint && (
                <div className="mt-1 text-xs text-zinc-600">{altPriceHint}</div>
              )}
            </div>
          </>
        ) : (
          <div className="mb-5 text-sm text-zinc-500">Выберите тариф выше</div>
        )}

        <button
          type="button"
          onClick={handleCheckout}
          disabled={!selectedCode || processing}
          className="h-12 w-full rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:border-cyan-200/35 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {processing ? 'Обработка...' : 'Оплатить'}
        </button>

        {step === 'error' && errorMsg && (
          <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/[0.05] px-4 py-3 text-sm text-red-200/85">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 space-y-1 border-t border-white/[0.06] pt-4">
          <div className="text-xs text-zinc-600">Оплата через ЮKassa · Безопасный платёж</div>
          <div className="text-xs text-zinc-700">
            Исполнитель: Полякова Кристина Алексеевна · ИНН 645325780844 · Самозанятый
            {' · '}
            <a href="/legal" className="underline transition-colors hover:text-zinc-500">
              Реквизиты
            </a>
            {' · '}
            <a href="/legal/oferta" className="underline transition-colors hover:text-zinc-500">
              Оферта
            </a>
            {' · '}
            <a href="/legal/privacy" className="underline transition-colors hover:text-zinc-500">
              Политика конфиденциальности
            </a>
          </div>
        </div>
      </Card>

      <button
        type="button"
        onClick={() => router.back()}
        className="mt-4 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        ← Назад
      </button>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  )
}
