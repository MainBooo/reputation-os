'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import BillingModal from './BillingModal'
import { getAdminBilling, getAdminPlans, type AdminBillingRow, type AdminPlan } from '@/lib/api/admin'

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function PlanBadge({ code, plans }: { code: string; plans: AdminPlan[] }) {
  const plan = plans.find((p) => p.code === code)
  const colors: Record<string, string> = {
    FREE: 'border-white/10 text-zinc-400',
    START: 'border-cyan-400/25 text-cyan-200',
    PRO: 'border-violet-400/25 text-violet-200',
    AGENCY: 'border-amber-400/25 text-amber-200'
  }
  const label = plan ? plan.name : code
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${colors[code] || 'border-white/10 text-zinc-400'}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-zinc-600">Без подписки</span>
  const colors: Record<string, string> = {
    ACTIVE: 'text-emerald-300',
    MANUAL: 'text-cyan-300',
    TRIAL: 'text-amber-300',
    PAUSED: 'text-zinc-400',
    PAST_DUE: 'text-orange-300',
    CANCELED: 'text-red-400',
    EXPIRED: 'text-red-300'
  }
  return <span className={`text-xs font-medium ${colors[status] || 'text-zinc-400'}`}>{status}</span>
}

export default function BillingTab({ onToast }: { onToast: (msg: string, ok?: boolean) => void }) {
  const [rows, setRows] = useState<AdminBillingRow[]>([])
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminBillingRow | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [data, planList] = await Promise.all([getAdminBilling(), getAdminPlans()])
      setRows(Array.isArray(data) ? data : [])
      setPlans(Array.isArray(planList) ? planList : [])
    } catch (e: any) {
      onToast(e.message || 'Ошибка загрузки', false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved(updated: AdminBillingRow) {
    setRows((prev) => prev.map((r) => r.id === updated.id ? updated : r))
    setEditing(null)
    onToast('Подписка обновлена')
  }

  const ov = (ws: AdminBillingRow) => ws.overrides as Record<string, unknown>

  function companiesCell(ws: AdminBillingRow) {
    const maxCo = ov(ws).maxCompanies
    const limitStr = maxCo === undefined || maxCo === null
      ? <span className="text-zinc-600">по тарифу</span>
      : (maxCo as number) === -1
        ? <span className="text-emerald-400">∞</span>
        : <span className="text-zinc-500">{String(maxCo)}</span>
    return (
      <div className="text-xs">
        <span className="text-zinc-300">{ws.companiesCount}</span>
        <span className="text-zinc-600"> / </span>
        {limitStr}
      </div>
    )
  }

  return (
    <>
      {editing && (
        <BillingModal
          workspace={editing}
          plans={plans}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 px-5 py-4 text-sm font-semibold text-white">
          {loading ? 'Загрузка...' : `${rows.length} workspace`}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#070b16]/95 text-xs uppercase tracking-[0.14em] text-zinc-500 backdrop-blur">
              <tr>
                <th className="px-5 py-3">Workspace</th>
                <th className="px-5 py-3">Тариф</th>
                <th className="px-5 py-3">Статус</th>
                <th className="px-5 py-3">До</th>
                <th className="px-5 py-3">Компании</th>
                <th className="px-5 py-3">WEB</th>
                <th className="px-5 py-3">TG</th>
                <th className="px-5 py-3">Push</th>
                <th className="px-5 py-3">Заметка</th>
                <th className="px-5 py-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={10}><div className="mx-5 my-3 h-10 animate-pulse rounded-xl bg-white/[0.02]" /></td></tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-zinc-500">Нет данных</td></tr>
              ) : rows.map((ws) => (
                <tr key={ws.id} className={`text-zinc-300 ${!ws.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{ws.name}</div>
                    <div className="text-xs text-zinc-600">{ws.slug}</div>
                    {ws.owner && <div className="text-xs text-zinc-600">{ws.owner.email}</div>}
                  </td>
                  <td className="px-5 py-3"><PlanBadge code={ws.planCode} plans={plans} /></td>
                  <td className="px-5 py-3"><StatusBadge status={ws.subscriptionStatus} /></td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{fmt(ws.currentPeriodEnd)}</td>
                  <td className="px-5 py-3">{companiesCell(ws)}</td>
                  <td className="px-5 py-3">{ov(ws).webMonitoringEnabled ? <span className="text-emerald-400 text-xs">✓</span> : <span className="text-zinc-700 text-xs">—</span>}</td>
                  <td className="px-5 py-3">{ov(ws).telegramNotifications ? <span className="text-emerald-400 text-xs">✓</span> : <span className="text-zinc-700 text-xs">—</span>}</td>
                  <td className="px-5 py-3">{ov(ws).pushNotificationsEnabled ? <span className="text-emerald-400 text-xs">✓</span> : <span className="text-zinc-700 text-xs">—</span>}</td>
                  <td className="px-5 py-3 max-w-[120px]">
                    <div className="truncate text-xs text-zinc-600" title={ws.adminNote || undefined}>{ws.adminNote || '—'}</div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setEditing(ws)}
                      className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                    >
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-white/[0.06] px-5 py-3 text-xs text-zinc-700">
          Изменения вступают в силу немедленно. Webhook при ручном изменении не вызывается.
        </div>
      </Card>
    </>
  )
}
