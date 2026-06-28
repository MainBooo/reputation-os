'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { getAuditLogs, type AuditLogItem } from '@/lib/api/admin'

const ACTION_LABELS: Record<string, string> = {
  USER_DISABLED: 'Пользователь отключён',
  USER_ENABLED: 'Пользователь включён',
  USER_ROLE_CHANGED: 'Роль изменена',
  WORKSPACE_DISABLED: 'Workspace отключён',
  WORKSPACE_ENABLED: 'Workspace включён',
  SUBSCRIPTION_CHANGED: 'Подписка изменена',
  SUBSCRIPTION_LIMITS_CHANGED: 'Лимиты изменены',
  BILLING_STATUS_CHANGED: 'Статус биллинга изменён',
  ADMIN_HEALTH_VIEWED: 'Просмотр здоровья системы'
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    USER_DISABLED: 'border-red-400/20 bg-red-500/10 text-red-300',
    USER_ENABLED: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    USER_ROLE_CHANGED: 'border-amber-400/20 bg-amber-500/10 text-amber-300',
    WORKSPACE_DISABLED: 'border-red-400/20 bg-red-500/10 text-red-300',
    WORKSPACE_ENABLED: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    SUBSCRIPTION_CHANGED: 'border-violet-400/20 bg-violet-500/10 text-violet-300'
  }
  const cls = colors[action] || 'border-white/10 bg-white/[0.04] text-zinc-400'
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {ACTION_LABELS[action] || action}
    </span>
  )
}

function fmt(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AuditLogsTab() {
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const limit = 30

  async function load(p = 1) {
    setLoading(true)
    setLoadError('')
    try {
      const params: Record<string, string> = { page: String(p), limit: String(limit) }
      if (action) params.action = action
      if (dateFrom) params.dateFrom = new Date(dateFrom).toISOString()
      if (dateTo) params.dateTo = new Date(dateTo + 'T23:59:59').toISOString()
      const res = await getAuditLogs(params)
      setItems(res.items)
      setTotal(res.total)
    } catch (e: any) {
      setLoadError(e?.message || 'Не удалось загрузить логи')
    } finally { setLoading(false) }
  }

  useEffect(() => { load(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.ceil(total / limit)
  const ACTIONS = ['USER_DISABLED', 'USER_ENABLED', 'USER_ROLE_CHANGED', 'WORKSPACE_DISABLED', 'WORKSPACE_ENABLED', 'SUBSCRIPTION_CHANGED']

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-white/10 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <select value={action} onChange={(e) => setAction(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#070b16] px-3 text-sm text-zinc-100 outline-none min-w-[200px]">
            <option value="">Все действия</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 rounded-xl border border-white/10 bg-[#070b16] px-3 text-sm text-zinc-100 outline-none" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-10 rounded-xl border border-white/10 bg-[#070b16] px-3 text-sm text-zinc-100 outline-none" />
          <Button onClick={() => { setPage(1); load(1) }} disabled={loading} className="h-10">
            {loading ? '...' : 'Применить'}
          </Button>
          <button onClick={() => { setAction(''); setDateFrom(''); setDateTo(''); setPage(1); setTimeout(() => load(1), 0) }}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 hover:text-white">
            Сброс
          </button>
        </div>
        {total > 0 && !loadError && <div className="mt-2 text-xs text-zinc-600">{total} записей</div>}
        {loadError && (
          <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{loadError}</div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#070b16]/95 text-xs uppercase tracking-[0.14em] text-zinc-500 backdrop-blur">
            <tr>
              <th className="px-5 py-3">Дата</th>
              <th className="px-5 py-3">Администратор</th>
              <th className="px-5 py-3">Действие</th>
              <th className="px-5 py-3">Workspace</th>
              <th className="px-5 py-3">Цель</th>
              <th className="px-5 py-3">Детали</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={6}><div className="mx-5 my-2 h-8 animate-pulse rounded bg-white/[0.02]" /></td></tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-500">Нет записей</td></tr>
            ) : items.map((item) => (
              <>
                <tr key={item.id} className="text-zinc-300 cursor-pointer hover:bg-white/[0.015]" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                  <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmt(item.createdAt)}</td>
                  <td className="px-5 py-3 text-xs">
                    <div className="text-white">{item.actorUser?.fullName || item.actorUser?.email || item.actorEmail || '—'}</div>
                  </td>
                  <td className="px-5 py-3"><ActionBadge action={item.action} /></td>
                  <td className="px-5 py-3 text-xs text-zinc-400">{item.workspace?.name || '—'}</td>
                  <td className="px-5 py-3 text-xs text-zinc-400">
                    {item.targetUser ? (item.targetUser.fullName || item.targetUser.email) : '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-cyan-500">{expanded === item.id ? '▲' : '▼'}</td>
                </tr>
                {expanded === item.id && (
                  <tr key={item.id + '_detail'}>
                    <td colSpan={6} className="px-5 pb-4 pt-0">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 font-mono text-xs text-zinc-400">
                        <div className="mb-1 text-zinc-600">До:</div>
                        <pre className="mb-3 whitespace-pre-wrap break-all">{JSON.stringify(item.beforeJson, null, 2)}</pre>
                        <div className="mb-1 text-zinc-600">После:</div>
                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(item.afterJson, null, 2)}</pre>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-sm text-zinc-400">
          <span>Страница {page} из {pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1) }} className="disabled:opacity-40 hover:text-white">← Пред.</button>
            <button disabled={page >= pages} onClick={() => { setPage(page + 1); load(page + 1) }} className="disabled:opacity-40 hover:text-white">След. →</button>
          </div>
        </div>
      )}
    </Card>
  )
}
