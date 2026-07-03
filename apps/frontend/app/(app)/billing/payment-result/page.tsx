'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMetrica } from 'next-yandex-metrica'
import { CheckCircle2, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { getMyEntitlements, syncPendingPayments } from '@/lib/api/billing'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'

const MAX_POLLS = 10
const POLL_INTERVAL_MS = 3000

export default function PaymentResultPage() {
  const router = useRouter()
  const { refresh } = useSubscription()
  const { reachGoal } = useMetrica()
  const [status, setStatus] = useState<'checking' | 'success' | 'pending' | 'error'>('checking')
  const pollCount = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const ent = await getMyEntitlements()
        if (cancelled) return

        const isActive =
          ent?.subscriptionStatus === 'ACTIVE' || ent?.subscriptionStatus === 'MANUAL'

        if (isActive) {
          await refresh()
          reachGoal('payment_success')
          reachGoal('subscription_activated')
          setStatus('success')
          return
        }

        pollCount.current += 1
        if (pollCount.current >= MAX_POLLS) {
          setStatus('pending')
          return
        }

        setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    // Сначала синхронизируем статус с ЮKassa (fallback если webhook не пришёл),
    // затем начинаем polling entitlements
    syncPendingPayments().catch(() => {})
    const timer = setTimeout(poll, 1500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [refresh])

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-xl">
        {status === 'checking' && (
          <>
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-cyan-400" />
            <div className="text-lg font-semibold text-white">Проверяем оплату…</div>
            <div className="mt-2 text-sm text-zinc-500">
              Ожидаем подтверждение от платёжной системы.
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
            <div className="text-lg font-semibold text-white">Оплата прошла успешно</div>
            <div className="mt-2 text-sm text-zinc-400">Тариф активирован. Приятной работы!</div>
            <button
              type="button"
              onClick={() => router.push('/settings/billing')}
              className="mt-6 h-11 w-full rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-6 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110"
            >
              Перейти в настройки
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <RotateCcw className="mx-auto mb-4 h-12 w-12 text-amber-400" />
            <div className="text-lg font-semibold text-white">Платёж обрабатывается</div>
            <div className="mt-2 text-sm text-zinc-400">
              Платёж принят, но ещё не подтверждён банком. Обновите страницу через несколько секунд.
            </div>
            <button
              type="button"
              onClick={() => { pollCount.current = 0; setStatus('checking') }}
              className="mt-6 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-6 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
            >
              Проверить ещё раз
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <div className="text-lg font-semibold text-white">Не удалось проверить оплату</div>
            <div className="mt-2 text-sm text-zinc-400">
              Если деньги списались — обратитесь в поддержку. Тариф активируется автоматически.
            </div>
            <button
              type="button"
              onClick={() => router.push('/billing/checkout')}
              className="mt-6 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-6 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
            >
              Вернуться к тарифам
            </button>
          </>
        )}
      </div>
    </div>
  )
}
