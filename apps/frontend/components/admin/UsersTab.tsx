'use client'

import { useEffect, useRef, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ConfirmModal from './ConfirmModal'
import { getAdminUsers, updateUserRole, updateUserStatus, type AdminUser, type AdminSystemRole } from '@/lib/api/admin'

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: '2-digit' })
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'SUPER_ADMIN')
    return <span className="inline-flex rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">Super Admin</span>
  return <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-zinc-400">USER</span>
}

function StatusBadge({ active }: { active: boolean }) {
  return active
    ? <span className="text-xs font-medium text-emerald-300">Активен</span>
    : <span className="text-xs font-medium text-red-300">Отключён</span>
}

export default function UsersTab({ onToast }: { onToast: (msg: string, ok?: boolean) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [savingId, setSavingId] = useState('')
  const [confirm, setConfirm] = useState<{ userId: string; isActive: boolean; name: string } | null>(null)

  const limit = 20

  async function load(p = 1) {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(p), limit: String(limit) }
      if (q.trim()) params.q = q.trim()
      if (roleFilter) params.systemRole = roleFilter
      if (statusFilter) params.status = statusFilter
      const res = await getAdminUsers(params)
      setUsers(res.items)
      setTotal(res.total)
    } catch (e: any) {
      onToast(e.message || 'Ошибка загрузки', false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function search() { setPage(1); load(1) }

  async function handleRoleChange(userId: string, role: AdminSystemRole) {
    setSavingId(userId)
    try {
      await updateUserRole(userId, role)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, systemRole: role } : u))
      onToast('Роль обновлена')
    } catch (e: any) {
      onToast(e.message || 'Ошибка', false)
    } finally {
      setSavingId('')
    }
  }

  async function handleStatusToggle(userId: string, isActive: boolean, name: string) {
    if (!isActive) {
      setConfirm({ userId, isActive, name })
      return
    }
    doStatusChange(userId, isActive)
  }

  async function doStatusChange(userId: string, isActive: boolean) {
    setSavingId(userId)
    try {
      await updateUserStatus(userId, isActive)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive } : u))
      onToast(isActive ? 'Пользователь включён' : 'Пользователь отключён')
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
          title="Отключить пользователя?"
          description={`Пользователь ${confirm.name} потеряет доступ к платформе.`}
          confirmLabel="Отключить"
          danger
          onConfirm={() => { doStatusChange(confirm.userId, confirm.isActive); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email или имя" onKeyDown={(e) => e.key === 'Enter' && search()} />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#070b16] px-3 text-sm text-zinc-100 outline-none">
              <option value="">Все роли</option>
              <option value="USER">USER</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#070b16] px-3 text-sm text-zinc-100 outline-none">
              <option value="">Все статусы</option>
              <option value="active">Активные</option>
              <option value="disabled">Отключённые</option>
            </select>
            <Button onClick={search} disabled={loading} className="h-10">
              {loading ? 'Загрузка...' : 'Найти'}
            </Button>
            <button onClick={() => { setQ(''); setRoleFilter(''); setStatusFilter(''); setPage(1); setTimeout(() => load(1), 0) }} className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 transition hover:text-white">
              Сброс
            </button>
          </div>
          {total > 0 && <div className="mt-2 text-xs text-zinc-600">{total} пользователей</div>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#070b16]/95 text-xs uppercase tracking-[0.14em] text-zinc-500 backdrop-blur">
              <tr>
                <th className="px-5 py-3">Пользователь</th>
                <th className="px-5 py-3">Роль</th>
                <th className="px-5 py-3">Workspace</th>
                <th className="px-5 py-3">Статус</th>
                <th className="px-5 py-3">Посл. вход</th>
                <th className="px-5 py-3">Создан</th>
                <th className="px-5 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {users.map((user) => (
                <tr key={user.id} className="text-zinc-300">
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">{user.fullName || '—'}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{user.email}</div>
                    <div className="mt-1 flex gap-1.5">
                      {user.telegramConnected && <span className="text-[10px] text-cyan-500">TG</span>}
                      {user.pushConnected && <span className="text-[10px] text-violet-400">Push</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={user.systemRole}
                      disabled={savingId === user.id}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as AdminSystemRole)}
                      className="h-8 rounded-lg border border-white/10 bg-[#070b16] px-2 text-xs font-medium text-zinc-100 outline-none disabled:opacity-60"
                    >
                      <option value="USER">USER</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    {user.workspaceMembers.length > 0
                      ? user.workspaceMembers.map((m) => (
                          <div key={m.id} className="text-xs">
                            <span className="text-white">{m.workspace.name}</span>
                            <span className="ml-1 text-zinc-600">·{m.role}</span>
                          </div>
                        ))
                      : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-4"><StatusBadge active={user.isActive} /></td>
                  <td className="px-5 py-4 text-zinc-500 text-xs">{fmt(user.lastLoginAt)}</td>
                  <td className="px-5 py-4 text-zinc-500 text-xs">{fmt(user.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      disabled={savingId === user.id}
                      onClick={() => handleStatusToggle(user.id, !user.isActive, user.email)}
                      className={user.isActive
                        ? 'rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-60'
                        : 'rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-60'
                      }
                    >
                      {savingId === user.id ? '...' : user.isActive ? 'Отключить' : 'Включить'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-zinc-500">Пользователи не найдены</td></tr>
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
