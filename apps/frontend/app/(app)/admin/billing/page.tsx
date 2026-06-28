'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import { me } from '@/lib/api/auth'
import {
  getAdminBillingWorkspaces,
  getAdminBillingPlans,
  adminUpdateSubscription,
  adminSetOverride,
  type AdminBillingWorkspace,
  type BillingPlan,
} from '@/lib/api/billing'

const STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  trialing: 'Пробный',
  past_due: 'Просрочена',
  canceled: 'Отменена',
}

function statusBadgeClass(status: string | null) {
  if (status === 'active') return 'border-emerald-300/25 bg-emerald-400/[0.10] text-emerald-100'
  if (status === 'trialing') return 'border-cyan-300/25 bg-cyan-400/[0.10] text-cyan-100'
  if (status === 'past_due') return 'border-amber-300/25 bg-amber-400/[0.10] text-amber-100'
  return 'border-white/10 bg-white/[0.05] text-zinc-400'
}

const selectClass =
  'h-9 rounded-xl border border-white/10 bg-[#0b1120] px-3 text-sm font-medium text-white outline-none transition hover:border-cyan-300/30 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/10 disabled:opacity-60'

function WorkspaceRow({
  workspace,
  plans,
  saving,
  onPlanChange,
}: {
  workspace: AdminBillingWorkspace
  plans: BillingPlan[]
  saving: boolean
  onPlanChange: (planCode: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 transition hover:bustitled sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-semibold text-white">
            {workspace.name || workspace.slug}
          </div>
          <div
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(workspace.subscriptionStatus)}`}
          >
            {workspace.subscriptionStatus
               ? (STATUS_LABELS[workspace.subscriptionStatus] ?? workspace.subscriptionStatus)
              : 'Нет подписки'}
          </div>
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">{workspace.slug}</div>
        {workspace.currentPeriodEnd && (
          <div className="mt-0.5 text-xs text-zinc-600">
            до{' '}
            {new Date(workspace.currentPeriodEnd).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={workspace.planCode ?? ''}
          onChange={(e) => onPlanChange(e.target.value)}
          disabled={saving}
          className={selectClass}
        >
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
               {p.name}
              {p.priceMonthly > 0 ? ` -- ${p.priceMonthly.toLocaleString('ru-RU')} ₽` : ' --  Бесплатно'}
            </option>
          ))}
        </select>
        {saving && <div className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-cyan-400" />}
      </div>
    </div>
  )
}

export default function AdminBillingPage() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<AdminBillingWorkspace[]>([])
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    me()
      .then((user) => {
        if ((user as any)?.systemRole !== 'SUPER_ADMIN') router.replace('/')
      })
      .catch(() => router.replace('/'))
  }, [router])

  useEffect(() => {
    Promise.all([getAdminBillingWorkspaces(), getAdminBillingPlans()])
      .then(([ws, pl]) => {
        setWorkspaces(Array.isArray(ws) ? ws : [])
        setPlans(Array.isArray(pl) ? pl : [])
      })
      .finally(() => setLoading(false))
  }, [])

  async function handlePlanChange(workspaceId: string, planCode: string) {
    setSavingId(workspaceId)
    setMessage('')
    try {
      await adminUpdateSubscription(workspaceId, { planCode })
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === workspaceId ? { ...w, planCode } : w)),
      )
      setMessage('Тариф обновлён.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка при обновлении тарифа.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-white">Биллинг</div>
          <div className="mt-1 text-sm text-zinc-400">
            Сучное управление тарифами всеслех воркспейсов.
          </div>
        </div>
        <div className="rounded-full border border-amber-300/25 bg-amber-400/[0.10] px-3 py-1 text-xs font-medium text-amber-100">
          SUPER ADMIN
        </div>
      </div>
      {message && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-zinc-300">
          {message}
        </div>
      )}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] px-5 py-4">
          <div className="text-sm font-semibold text-white">
            {loading ? 'Загрузка...' : `${workspaces.length} воркспейсоо`}
          </div>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {loading ? (
            <>
              <div className="h-16 animate-pulse bg-white/[0.02]" />
              <div className="h-16 animate-pulse bg-white/[0.02]" />
              <div className="h-16 animate-pulse bg-white/[0.02]" />
            </>
          ) : workspaces.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-500">
              Воркспейсы не найдены.
            </div>
          ) : (
            workspaces.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                workspace={ws}
                plans={plans}
                saving={savingId === ws.id}
                onPlanChange={(planCode) => handlePlanChange(ws.id, planCode)}
              />
            ))
          )}
        </div>
      </Card>
      <div className="mt-4 text-xs text-zinc-600">
        Izmeneniya vstupayut v silu nemedlenno. Webhook pri ruchnoy smene ne vyzyvaetsya.
      </div>
    </div>
  )
}
