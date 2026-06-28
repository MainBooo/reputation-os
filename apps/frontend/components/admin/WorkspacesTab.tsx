'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ConfirmModal from './ConfirmModal'
import { getAdminWorkspaces, updateWorkspaceStatus, type AdminWorkspace } from '@/lib/api/admin'

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: '2-digit' })
}

function PlanBadge({ code }: { code: string }) {
  const colors: Record<string, string> = {
    FREE: 'border-white/10 bg-white/[0.04] text-zinc-400',
    STARTER: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200',
    START: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200',
    PRO: 'border-violet-400/25 bg-violet-500/10 text-violet-200',
    BUSINESS: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
    AGENCY: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
    ENTERPRISE: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
    CUSTOM: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200'
  }
  const cls = colors[code] || colors.FREE
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{code}</span>
}

function SubStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-zinc-600">—</span>
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

export default function WorkspacesTab({ onToast }: { onToast: (msg: string, ok?: boolean) => void }) {
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [savingId, setSavingId] = useState('')
  const [confirm, setConfirm] = useState<{ id: string; isActive: boolean; name: string } | null>(null)

  const limit = 20

  async function load(p = 1) {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(p), limit: String(limit) }
      if (q.trim()) params.q = q.trim()
      if (statusFilter) params.status = statusFilter
      const res = await getAdminWorkspaces(params)
      setWorkspaces(res.items)
      setTotal(res.total)
    } catch (e: any) {
      onToast(e.message || 'Ошибка загрузки', false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function search() { setPage(1); load(1) }

  async function doStatusChange(id: string, isActive: boolean) {
    setSavingId(id)
    try {
      await updateWorkspaceStatus(id, isActive)
      setWorkspaces((prev) => prev.map((w) => w.id === id ? { ...w, isActive } : w))
      onToast(isActive ? 'Workspace включён' : 'Workspace отключён')
    } catch (e: any) {
      onToast(e.message || 'Ошибка', false)
    } finally {
      setSavingId('')
    }
  }

  const pages = Math.ceil(total / limit)

  return (
    <>
      {confirm && (
        <ConfirmModal
          title="Отключить workspace?"
          description={`Все пользователи workspace "${confirm.name}" потеряют доступ.`}
          confirmLabel="Отключить"
          danger
          onConfirm={() => { doStatusChange(confirm.id, confirm.isActive); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или slug" onKeyDown={(e) => e.key === 'Enter' && search()} />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#070b16] px-3 text-sm text-zinc-100 outline-none">
              <option value="">Все</option>
              <option value="active">Активные</option>
              <option value="disabled">Отключённые</option>
            </select>
            <Button onClick={search} disabled={loading} className="h-10">{loading ? 'Загрузка...' : 'Найти'}</Button>
            <button onClick={() => { setQ(''); setStatusFilter(''); setPage(1); setTimeout(() => load(1), 0) }} className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 hover:text-white">
              Сброс
            </button>
          </div>
          {total > 0 && <div className="mt-2 text-xs text-zinc-600">{total} workspace</div>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#070b16]/95 text-xs uppercase tracking-[0.14em] text-zinc-500 backdrop-blur">
              <tr>
                <th className="px-5 py-3">Workspace</th>
                <th className="px-5 py-3">Владелец</th>
                <th className="px-5 py-3">Участники</th>
                <th className="px-5 py-3">Компании</th>
                <th className="px-5 py-3">Тариф</th>
                <th className="px-5 py-3">Статус</th>
                <th className="px-5 py-3">До</th>
                <th className="px-5 py-3">Создан</th>
                <th className="px-5 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {workspaces.map((ws) => (
                <tr key={ws.id} className={`text-zinc-300 ${!ws.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">{ws.name}</div>
                    <div className="mt-0.5 text-xs text-zinc-600">{ws.slug}</div>
                  </td>
                  <td className="px-5 py-4 text-xs">
                    {ws.owner ? (
                      <>
                        <div className="text-white">{ws.owner.fullName || ws.owner.email}</div>
                        <div className="text-zinc-600">{ws.owner.fullName ? ws.owner.email : ''}</div>
                      </>
                    ) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-4 text-center">{ws.membersCount}</td>
                  <td className="px-5 py-4 text-center">{ws.companiesCount}</td>
                  <td className="px-5 py-4"><PlanBadge code={ws.planCode} /></td>
                  <td className="px-5 py-4"><SubStatusBadge status={ws.subscriptionStatus} /></td>
                  <td className="px-5 py-4 text-xs text-zinc-500">{fmt(ws.currentPeriodEnd)}</td>
                  <td className="px-5 py-4 text-xs text-zinc-500">{fmt(ws.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      disabled={savingId === ws.id}
                      onClick={() => {
                        if (!ws.isActive) { doStatusChange(ws.id, true); return }
                        setConfirm({ id: ws.id, isActive: false, name: ws.name })
                      }}
                      className={ws.isActive
                        ? 'rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-60'
                        : 'rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60'
                      }
                    >
                      {savingId === ws.id ? '...' : ws.isActive ? 'Отключить' : 'Включить'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && workspaces.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-zinc-500">Workspace не найдены</td></tr>
              )}
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
    </>
  )
}
