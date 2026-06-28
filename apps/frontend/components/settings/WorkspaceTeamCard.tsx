'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { getWorkspaces } from '@/lib/api/companies'
import { me, type AuthMe } from '@/lib/api/auth'
import {
  addWorkspaceMember,
  getWorkspaceMembers,
  leaveWorkspace,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type WorkspaceMember,
  type WorkspaceRole
} from '@/lib/api/workspaces'
import { WORKSPACE_STORAGE_KEY } from '@/lib/workspace-selection'

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Админ',
  MEMBER: 'Участник'
}

const ALL_ROLE_OPTIONS: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER']
const ADMIN_ROLE_OPTIONS: WorkspaceRole[] = ['ADMIN', 'MEMBER']
const INVITE_ROLE_OPTIONS: WorkspaceRole[] = ['ADMIN', 'MEMBER']

type Workspace = {
  id: string
  name?: string
  slug?: string
}

function getInitials(member: WorkspaceMember) {
  const value = member.user?.fullName || member.user?.email || 'U'
  return value
    .split(/[ @._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('')
}

function roleBadgeClass(role: WorkspaceRole) {
  if (role === 'OWNER') return 'border-amber-300/25 bg-amber-400/[0.10] text-amber-100'
  if (role === 'ADMIN') return 'border-cyan-300/25 bg-cyan-400/[0.10] text-cyan-100'
  return 'border-white/10 bg-white/[0.05] text-zinc-300'
}

function pluralRu(value: number, one: string, few: string, many: string) {
  const abs = Math.abs(value)
  const mod10 = abs % 10
  const mod100 = abs % 100

  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const selectClass =
  'h-11 rounded-2xl border border-white/10 bg-[#0b1120] px-4 text-sm font-medium text-brand outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-cyan-300/30 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/10 disabled:opacity-60'

export default function WorkspaceTeamCard() {
  const [currentUser, setCurrentUser] = useState<AuthMe | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('MEMBER')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const selectedWorkspace = useMemo(
    () => workspaces.find((item) => item.id === workspaceId) || workspaces[0],
    [workspaces, workspaceId]
  )

  const currentWorkspaceMember = useMemo(() => {
    const currentEmail = currentUser?.email?.toLowerCase()
    if (!currentEmail) return null
    return members.find((member) => member.user?.email?.toLowerCase() === currentEmail) || null
  }, [currentUser?.email, members])

  const ownersCount = members.filter((member) => member.role === 'OWNER').length
  const adminsCount = members.filter((member) => member.role === 'ADMIN').length

  // Permission flags for the current viewer
  const canManageTeam =
    currentWorkspaceMember?.role === 'OWNER' || currentWorkspaceMember?.role === 'ADMIN'
  const canManageOwners = currentWorkspaceMember?.role === 'OWNER'
  const isOnlyOwner = currentWorkspaceMember?.role === 'OWNER' && ownersCount <= 1

  // Role options available for the current user to assign
  const assignableRoleOptions = canManageOwners ? ALL_ROLE_OPTIONS : ADMIN_ROLE_OPTIONS

  const workspaceAccessLabel =
    currentWorkspaceMember?.role === 'OWNER'
      ? 'Мой workspace'
      : currentWorkspaceMember?.role
        ? `Доступ: ${ROLE_LABELS[currentWorkspaceMember.role]}`
        : 'Доступ не определён'

  const workspaceAccessClass =
    currentWorkspaceMember?.role === 'OWNER'
      ? 'border-emerald-300/25 bg-emerald-400/[0.12] text-emerald-100'
      : 'border-cyan-300/20 bg-cyan-400/[0.10] text-cyan-100'

  function isCurrentUserMember(member: WorkspaceMember) {
    return currentUser?.email?.toLowerCase() === member.user?.email?.toLowerCase()
  }

  async function loadMembers(nextWorkspaceId = workspaceId) {
    if (!nextWorkspaceId) return

    setLoading(true)
    setMessage('')

    try {
      const data = await getWorkspaceMembers(nextWorkspaceId)
      setMembers(Array.isArray(data) ? data : [])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось загрузить участников.')
    } finally {
      setLoading(false)
    }
  }

  async function reloadWorkspacesAfterLeave() {
    const list = await getWorkspaces()
    const nextWorkspaces: Workspace[] = Array.isArray(list) ? (list as Workspace[]) : []
    setWorkspaces(nextWorkspaces)

    const storedId = typeof window !== 'undefined' ? localStorage.getItem(WORKSPACE_STORAGE_KEY) : null
    const nextId =
      (storedId && nextWorkspaces.some((w) => w.id === storedId) ? storedId : null) ||
      nextWorkspaces[0]?.id ||
      ''

    if (nextId) {
      setWorkspaceId(nextId)
      if (typeof window !== 'undefined') localStorage.setItem(WORKSPACE_STORAGE_KEY, nextId)
      await loadMembers(nextId)
      return
    }

    setWorkspaceId('')
    setMembers([])
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true

    const stored = typeof window !== 'undefined' ? localStorage.getItem(WORKSPACE_STORAGE_KEY) : null

    Promise.all([me(), getWorkspaces()])
      .then(([userData, workspaceData]) => {
        if (!mounted) return

        setCurrentUser(userData)

        const list: Workspace[] = Array.isArray(workspaceData) ? (workspaceData as Workspace[]) : []
        setWorkspaces(list)

        // Use stored workspace if it's still valid, otherwise fall back to first
        const activeId =
          (stored && list.some((w) => w.id === stored) ? stored : null) || list[0]?.id || ''

        if (activeId) {
          setWorkspaceId(activeId)
          return loadMembers(activeId)
        }

        setLoading(false)
      })
      .catch((e: Error) => {
        if (!mounted) return
        setMessage(e.message || 'Не удалось загрузить workspace.')
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleWorkspaceChange(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId)
    if (typeof window !== 'undefined') localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspaceId)
    await loadMembers(nextWorkspaceId)
  }

  async function handleAddMember() {
    if (!workspaceId || !email.trim() || saving) return

    setSaving(true)
    setMessage('')

    try {
      await addWorkspaceMember(workspaceId, { email: email.trim().toLowerCase(), role })
      setEmail('')
      setRole('MEMBER')
      await loadMembers(workspaceId)
      setMessage('Приглашение отправлено. Пользователь увидит его в уведомлениях.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось добавить участника.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRoleChange(memberId: string, nextRole: WorkspaceRole) {
    if (!workspaceId || saving) return

    setSaving(true)
    setMessage('')

    try {
      await updateWorkspaceMemberRole(workspaceId, memberId, { role: nextRole })
      await loadMembers(workspaceId)
      setMessage('Роль обновлена.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось обновить роль.')
      await loadMembers(workspaceId)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(memberId: string) {
    if (!workspaceId || saving) return
    if (!confirm('Удалить участника из workspace?')) return

    setSaving(true)
    setMessage('')

    try {
      await removeWorkspaceMember(workspaceId, memberId)
      await loadMembers(workspaceId)
      setMessage('Участник удалён.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось удалить участника.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLeaveWorkspace() {
    if (!workspaceId || saving) return
    if (!confirm('Выйти из этого workspace?')) return

    setSaving(true)
    setMessage('')

    try {
      await leaveWorkspace(workspaceId)
      await reloadWorkspacesAfterLeave()
      setMessage('Вы вышли из workspace.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось выйти из workspace.')
    } finally {
      setSaving(false)
    }
  }

  function renderMemberActions(member: WorkspaceMember) {
    // Current user's own row
    if (isCurrentUserMember(member)) {
      if (isOnlyOwner) {
        return (
          <div className="max-w-xs text-xs leading-5 text-zinc-500">
            Вы владелец этого workspace. Чтобы выйти, сначала передайте роль владельца другому участнику.
          </div>
        )
      }
      return (
        <button
          type="button"
          onClick={handleLeaveWorkspace}
          disabled={saving}
          className="h-11 rounded-2xl border border-amber-300/20 bg-amber-500/[0.08] px-4 text-sm font-medium text-amber-100 transition hover:border-amber-300/35 hover:bg-amber-500/[0.12] disabled:opacity-60"
        >
          Выйти из workspace
        </button>
      )
    }

    // MEMBER viewer: no management controls for other members
    if (!canManageTeam) return null

    // ADMIN viewer: cannot manage OWNER members
    if (!canManageOwners && member.role === 'OWNER') return null

    return (
      <>
        <select
          value={member.role}
          onChange={(event) => handleRoleChange(member.id, event.target.value as WorkspaceRole)}
          disabled={saving}
          className={`${selectClass} min-w-32 flex-1 sm:flex-none`}
        >
          {assignableRoleOptions.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABELS[item]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => handleRemove(member.id)}
          disabled={saving}
          className="h-11 rounded-2xl border border-red-400/20 bg-red-500/[0.05] px-3 text-sm font-medium text-red-200/85 transition hover:border-red-300/20 hover:bg-red-500/[0.09] disabled:opacity-60"
        >
          Удалить
        </button>
      </>
    )
  }

  return (
    <Card className="overflow-hidden p-0 xl:col-span-2">
      <div className="relative border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-white">Команда и роли</div>
            <div className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">
              Управляйте доступом к workspace и ролями участников.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
                {members.length} {pluralRu(members.length, 'участник', 'участника', 'участников')}
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
                {adminsCount} {pluralRu(adminsCount, 'админ', 'админа', 'админов')}
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-medium ${workspaceAccessClass}`}>
                👑 {workspaceAccessLabel}
              </div>
            </div>
          </div>

          {workspaces.length > 1 ? (
            <select
              value={workspaceId}
              onChange={(event) => handleWorkspaceChange(event.target.value)}
              className={`${selectClass} w-full sm:w-64`}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name || workspace.slug || 'Workspace'}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="p-5">
        {canManageTeam ? (
          <div className="rounded-[1.35rem] border border-white/10 bg-[#0b1220]/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  {selectedWorkspace?.name || selectedWorkspace?.slug || 'Workspace'}
                </div>
                <div className="mt-1 text-xs text-zinc-500">Пригласите зарегистрированного пользователя</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_155px_auto]">
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email зарегистрированного пользователя"
              />

              <select
                value={role}
                onChange={(event) => setRole(event.target.value as WorkspaceRole)}
                className={selectClass}
              >
                {INVITE_ROLE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddMember}
                disabled={saving || !email.trim()}
                className="h-11 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-6 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),0_10px_30px_rgba(168,85,247,0.10),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:border-cyan-200/35 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? 'Отправляем...' : 'Пригласить'}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.35rem] border border-white/10 bg-[#0b1220]/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="text-sm font-semibold text-white">
              {selectedWorkspace?.name || selectedWorkspace?.slug || 'Workspace'}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Приглашать участников могут только владелец и администраторы.
            </div>
          </div>
        )}

        {message ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-zinc-300">
            {message}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {loading ? (
            <>
              <div className="h-20 animate-pulse rounded-[1.35rem] bg-white/[0.04]" />
              <div className="h-20 animate-pulse rounded-[1.35rem] bg-white/[0.04]" />
            </>
          ) : members.length ? (
            members.map((member) => (
              <div
                key={member.id}
                className="group flex flex-col gap-4 rounded-[1.35rem] border border-white/10 bg-[#050816]/50 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-cyan-300/20 hover:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.28),rgba(79,70,229,0.16),rgba(255,255,255,0.04))] text-sm font-bold text-white shadow-[0_12px_30px_rgba(34,211,238,0.10)]">
                    {getInitials(member)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-white">
                        {member.user?.fullName || member.user?.email || member.id}
                      </div>
                      <div className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClass(member.role)}`}>
                        {ROLE_LABELS[member.role] || member.role}
                      </div>
                    </div>
                    <div className="mt-1 truncate text-xs text-zinc-500">
                      {member.user?.email || 'email не указан'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  {renderMemberActions(member)}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              В workspace пока нет участников.
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
