'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Card from '@/components/ui/Card'
import {
  getBillingPlans,
  createCheckout,
  type BillingPlan,
} from '@/lib/api/billing'

function formatPrice(price: number) {
  return price.toLocaleString('ru-RU') + ' ₽/мес'
}

const PLATFORM_LABELS: Record<string, string> = {
  YANDEX: 'Яндекс Карты',
  TWO_GIS: '2ГИС',
  VK: 'VK',
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: BillingPlan
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-[1.35rem] border p-4 text-left transition ${
        selected
          ? 'border-cyan-300/40 bg-cyan-400/[0.08] shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      <div className="text-sm font-semibold text-white">{plan.name}</div>
      <div className="mt-1 text-lg font-bold text-cyan-100">{formatPrice(plan.priceMonthly)}</div>
      <div className="mt-2 space-y-1 text-xs text-zinc-500">
        <div>
          {plan.limits.maxCompanies === -1 ? '∞' : plan.limits.maxCompanies}{' '}
          {plan.limits.maxCompanies === 1 ? 'компания' : 'компании'}
        </div>
        <div>
          {plan.limits.maxAiRepliesPerMonth === -1
            ? 'Безлимит AI-ответов'
            : `${plan.limits.maxAiRepliesPerMonth} AI-ответов/мес`}
        </div>
        <div>
          {plan.limits.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', ')}
        </div>
        {plan.limits.telegramNotifications && <div>✓ Telegram-уведомления</div>}
        {plan.limits.advancedAnalytics && <div>✓ Расширенная аналитика</div>}
      </div>
    </button>
  )
}

function CheckoutInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPlan = searchParams.get('plan') ?? ''

  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [selectedCode, setSelectedCode] = useState(initialPlan)
  const [step, setStep] = useState<'select' | 'success' | 'error'>('select')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
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
      const result = await createCheckout(selectedCode)
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <div className="text-2xl font-bold text-white">Выбор тарифа</div>
        <div className="mt-1 text-sm text-zinc-400">
          Выберите план и подтвердите оплату.
        </div>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.code}
            plan={plan}
            selected={selectedCode === plan.code}
            onSelect={() => setSelectedCode(plan.code)}
          />
        ))}
      </div>
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">{selected?.name ?? '—'}
               </div>
            {selected && (
              <div className="mt-0.5 text-xs text-zinc-500">{formatPrice(selected.priceMonthly)}</div>
            )}
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={!selectedCode || processing}
            className="h-11 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-8 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:border-cyan-200/35 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {processing ? 'Обработка...' : 'Оплатить'}
          </button>
        </div>
        {step === 'error' && errorMsg && (
          <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/[0.05] px-4 py-3 text-sm text-red-200/85">
            {errorMsg}
          </div>
        )}
        <div className="mt-4 border-t border-white/[0.06] pt-4 text-xs text-zinc-600">
          Оплата через Yandex Pay · Тестовый режим
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
