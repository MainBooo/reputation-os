'use client'

import { useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getAdminUsers, updateAdminUser, type AdminSystemRole } from '@/lib/api/admin'

function roleLabel(role?: string) {
  if (role === 'SUPER_ADMIN') return 'Super admin'
  if (role === 'OWNER') return 'Владелец'
  if (role === 'ADMIN') return 'Админ'
  if (role === 'MEMBER') return 'Участник'
  if (role === 'USER') return 'USER'
  return role || '—'
}

function buildQuery(q: string, systemRole: string): Record<string, string> {
  const params: Record<string, string> = {}
  if (q.trim()) params.q = q.trim()
  if (systemRole) params.systemRole = systemRole
  return params
}

function RoleBadge({ role }: { role?: string }) {
  const isSuper = role === 'SUPER_ADMIN'

  return (
    <span className={isSuper
      ? 'inline-flex rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
      : 'inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-zinc-300'
    }>
      {roleLabel(role)}
    </span>
  )
}

function RoleSelect({
  value,
  disabled,
  onChange
}: {
  value?: string
  disabled?: boolean
  onChange: (value: AdminSystemRole) => void
}) {
  return (
    <select
      value={value || 'USER'}
      onChange={(event) => onChange(event.target.value as AdminSystemRole)}
      disabled={disabled}
      className="h-10 w-full rounded-xl border border-white/10 bg-[#070b16] px-3 text-sm font-semibold text-zinc-100 outline-none shadow-inner shadow-black/20 transition focus:border-cyan-400/30 disabled:opacity-60 md:w-[150px]"
    >
      <option value="USER">USER</option>
      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
    </select>
  )
}

export default function AdminUsersTable({ initialUsers }: { initialUsers: any[] }) {
  const [users, setUsers] = useState(Array.isArray(initialUsers) ? initialUsers : [])
  const [q, setQ] = useState('')
  const [systemRole, setSystemRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState('')
  const [message, setMessage] = useState('')

  const query = useMemo(() => buildQuery(q, systemRole), [q, systemRole])

  async function loadUsers(nextQuery = query) {
    setLoading(true)
    setMessage('')

    try {
      const res = await getAdminUsers(nextQuery)
      const data = res && 'items' in res ? (res as any).items : res
      setUsers(Array.isArray(data) ? data : [])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось загрузить пользователей.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    await loadUsers(query)
  }

  async function handleReset() {
    setQ('')
    setSystemRole('')
    await loadUsers({})
  }

  async function patchUser(userId: string, payload: { isActive?: boolean; systemRole?: AdminSystemRole }) {
    setSavingId(userId)
    setMessage('')

    try {
      await updateAdminUser(userId, payload)
      await loadUsers(query)
      setMessage('Пользователь обновлён.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось обновить пользователя.')
    } finally {
      setSavingId('')
    }
  }

  return (
    <Card className="mt-6 overflow-hidden rounded-[30px] border-white/10 bg-[#070b16]/95 p-0">
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xl font-semibold text-white">Пользователи</div>
            <div className="mt-1 text-sm text-zinc-400">Поиск, блокировка и системные роли аккаунтов.</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto_auto] xl:w-[720px]">
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Email или имя"
            />

            <select
              value={systemRole}
              onChange={(event) => setSystemRole(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-[#070b16] px-3 text-sm font-semibold text-zinc-100 outline-none focus:border-cyan-400/30"
            >
              <option value="">Все роли</option>
              <option value="USER">USER</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>

            <Button type="button" onClick={handleSearch} disabled={loading}>
              {loading ? 'Ищем...' : 'Найти'}
            </Button>

            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-60"
            >
              Сброс
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
            {message}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">{user.fullName || 'Без имени'}</div>
                <div className="mt-1 truncate text-xs text-zinc-500">{user.email}</div>
              </div>

              <RoleBadge role={user.systemRole || 'USER'} />
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-zinc-600">System role</div>
                <RoleSelect
                  value={user.systemRole || 'USER'}
                  disabled={savingId === user.id}
                  onChange={(value) => patchUser(user.id, { systemRole: value })}
                />
              </div>

              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-zinc-600">Workspace</div>
                <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-zinc-300">
                  {Array.isArray(user.workspaceMembers) && user.workspaceMembers.length
                    ? user.workspaceMembers.map((member: any) => (
                        <div key={member.id} className="mb-1 last:mb-0">
                          <span className="text-white">{member.workspace?.name || member.workspace?.slug || 'Workspace'}</span>
                          <span className="ml-2 text-xs text-zinc-500">{roleLabel(member.role)}</span>
                        </div>
                      ))
                    : '—'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">Статус</div>
                  <div className={user.isActive ? 'mt-1 text-sm font-semibold text-emerald-300' : 'mt-1 text-sm font-semibold text-red-300'}>
                    {user.isActive ? 'Активен' : 'Отключён'}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">Создан</div>
                  <div className="mt-1 text-sm text-zinc-400">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '—'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => patchUser(user.id, { isActive: !user.isActive })}
                disabled={savingId === user.id}
                className={user.isActive
                  ? 'h-11 rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-60'
                  : 'h-11 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-60'
                }
              >
                {savingId === user.id ? 'Сохраняем...' : user.isActive ? 'Отключить пользователя' : 'Включить пользователя'}
              </button>
            </div>
          </div>
        ))}

        {!users.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-8 text-center text-zinc-400">
            Пользователи не найдены.
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="px-5 py-3">Пользователь</th>
              <th className="px-5 py-3">System role</th>
              <th className="px-5 py-3">Workspace</th>
              <th className="px-5 py-3">Статус</th>
              <th className="px-5 py-3">Создан</th>
              <th className="px-5 py-3 text-right">Действия</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {users.map((user) => (
              <tr key={user.id} className="text-zinc-300">
                <td className="px-5 py-4">
                  <div className="font-semibold text-white">{user.fullName || 'Без имени'}</div>
                  <div className="mt-1 text-xs text-zinc-500">{user.email}</div>
                </td>

                <td className="px-5 py-4">
                  <RoleSelect
                    value={user.systemRole || 'USER'}
                    disabled={savingId === user.id}
                    onChange={(value) => patchUser(user.id, { systemRole: value })}
                  />
                </td>

                <td className="px-5 py-4">
                  {Array.isArray(user.workspaceMembers) && user.workspaceMembers.length
                    ? user.workspaceMembers.map((member: any) => (
                        <div key={member.id} className="mb-1 last:mb-0">
                          <span className="text-white">{member.workspace?.name || member.workspace?.slug || 'Workspace'}</span>
                          <span className="ml-2 text-xs text-zinc-500">{roleLabel(member.role)}</span>
                        </div>
                      ))
                    : '—'}
                </td>

                <td className="px-5 py-4">
                  <span className={user.isActive ? 'text-emerald-300' : 'text-red-300'}>
                    {user.isActive ? 'Активен' : 'Отключён'}
                  </span>
                </td>

                <td className="px-5 py-4 text-zinc-500">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '—'}
                </td>

                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => patchUser(user.id, { isActive: !user.isActive })}
                    disabled={savingId === user.id}
                    className={user.isActive
                      ? 'rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-60'
                      : 'rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-60'
                    }
                  >
                    {savingId === user.id ? '...' : user.isActive ? 'Отключить' : 'Включить'}
                  </button>
                </td>
              </tr>
            ))}

            {!users.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-zinc-400">
                  Пользователи не найдены.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
