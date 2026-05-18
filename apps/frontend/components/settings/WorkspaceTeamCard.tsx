'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getWorkspaces } from '@/lib/api/companies'
import {
  addWorkspaceMember,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type WorkspaceMember,
  type WorkspaceRole
} from '@/lib/api/workspaces'

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Админ',
  MEMBER: 'Участник'
}

const ROLE_OPTIONS: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER']
const INVITE_ROLE_OPTIONS: WorkspaceRole[] = ['ADMIN', 'MEMBER']

type Workspace = {
  id: string
  name?: string
  slug?: string
}

export default function WorkspaceTeamCard() {
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

  useEffect(() => {
    let mounted = true

    getWorkspaces()
      .then((data: Workspace[]) => {
        if (!mounted) return
        const list = Array.isArray(data) ? data : []
        setWorkspaces(list)

        if (list[0]?.id) {
          setWorkspaceId(list[0].id)
          return loadMembers(list[0].id)
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
  }, [])

  async function handleWorkspaceChange(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId)
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
      setMessage('Участник добавлен.')
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

  return (
    <Card className="p-5 xl:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base font-semibold text-brand">Команда и роли</div>
          <div className="mt-2 text-sm leading-6 text-zinc-300">
            Управляйте доступом к рабочему пространству: владелец, админ или участник.
          </div>
        </div>

        {workspaces.length > 1 ? (
          <select
            value={workspaceId}
            onChange={(event) => handleWorkspaceChange(event.target.value)}
            className="h-10 rounded-xl border border-line bg-[#050816] px-3 text-sm text-brand outline-none"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name || workspace.slug || 'Workspace'}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 text-sm font-semibold text-white">
          {selectedWorkspace?.name || selectedWorkspace?.slug || 'Workspace'}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email зарегистрированного пользователя"
          />

          <select
            value={role}
            onChange={(event) => setRole(event.target.value as WorkspaceRole)}
            className="h-11 rounded-xl border border-line bg-[#050816] px-3 text-sm text-brand outline-none"
          >
            {ROLE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABELS[item]}
              </option>
            ))}
          </select>

          <Button type="button" onClick={handleAddMember} disabled={saving || !email.trim()}>
            {saving ? 'Сохраняем...' : 'Добавить'}
          </Button>
        </div>
      </div>

      {message ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">
          {message}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {loading ? (
          <>
            <div className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
            <div className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
          </>
        ) : members.length ? (
          members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#050816]/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {member.user?.fullName || member.user?.email || member.id}
                </div>
                <div className="mt-1 truncate text-xs text-zinc-400">
                  {member.user?.email || 'email не указан'} · {ROLE_LABELS[member.role] || member.role}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={member.role}
                  onChange={(event) => handleRoleChange(member.id, event.target.value as WorkspaceRole)}
                  disabled={saving}
                  className="h-10 rounded-xl border border-line bg-[#050816] px-3 text-sm text-brand outline-none disabled:opacity-60"
                >
                  {ROLE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleRemove(member.id)}
                  disabled={saving}
                  className="h-10 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
            В workspace пока нет участников.
          </div>
        )}
      </div>
    </Card>
  )
}
