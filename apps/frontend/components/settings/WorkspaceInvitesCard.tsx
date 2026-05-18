'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  Copy,
  Mail,
  Plus,
  Shield,
  Sparkles,
  UserPlus
} from 'lucide-react'

import Card from '@/components/ui/Card'
import {
  createWorkspaceInvite,
  getWorkspaceInvites,
  type WorkspaceInvite
} from '@/lib/api/workspaces'
import { getWorkspaces } from '@/lib/api/companies'

type Workspace = {
  id: string
  name: string
  slug?: string
}

function formatInviteError(message: string) {
  if (message.includes('Workspace user limit reached')) {
    return 'Лимит тарифа: максимум 2 пользователя в workspace.'
  }

  if (message.includes('Invite already exists')) {
    return 'Приглашение для этого email уже создано.'
  }

  if (message.includes('User already in workspace')) {
    return 'Этот пользователь уже добавлен в workspace.'
  }

  return message || 'Не удалось создать приглашение'
}

export default function WorkspaceInvitesCard() {
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(targetWorkspaceId: string) {
    if (!targetWorkspaceId) return

    try {
      const data = await getWorkspaceInvites(targetWorkspaceId)
      setInvites(Array.isArray(data) ? data : [])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось загрузить приглашения'
      setError(formatInviteError(message))
    }
  }

  useEffect(() => {
    let active = true

    getWorkspaces()
      .then((data: Workspace[]) => {
        if (!active) return

        const list = Array.isArray(data) ? data : []
        const firstWorkspaceId = list[0]?.id || ''

        setWorkspaces(list)
        setWorkspaceId(firstWorkspaceId)

        if (firstWorkspaceId) {
          load(firstWorkspaceId)
        }
      })
      .catch((e: Error) => {
        if (!active) return
        setError(e.message || 'Не удалось загрузить workspace')
      })

    return () => {
      active = false
    }
  }, [])

  async function handleCreate() {
    if (!workspaceId) {
      setError('Выберите workspace для приглашения.')
      return
    }

    if (!email.trim()) {
      setError('Введите email для приглашения.')
      return
    }

    setError('')
    setLoading(true)

    try {
      await createWorkspaceInvite(workspaceId, {
        email: email.trim(),
        role
      })

      setEmail('')
      await load(workspaceId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось создать приглашение'
      setError(formatInviteError(message))
    } finally {
      setLoading(false)
    }
  }

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : ''

  return (
    <Card className="border border-cyan-400/15 bg-[#07111f]/90">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
              <UserPlus className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white">
                Приглашения
              </h3>

              <p className="text-sm text-slate-400">
                Invite-ссылки и доступы команды
              </p>
            </div>
          </div>
        </div>

        <div className="hidden rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.08] px-3 py-2 text-xs text-cyan-100 lg:flex lg:items-center lg:gap-2">
          <Sparkles className="h-4 w-4" />
          Team access
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_220px_180px_140px]">
        <select
          value={workspaceId}
          onChange={(e) => {
            const nextWorkspaceId = e.target.value
            setWorkspaceId(nextWorkspaceId)
            setInvites([])
            setError('')
            load(nextWorkspaceId)
          }}
          className="h-12 rounded-2xl border border-white/10 bg-[#0b1727] px-4 text-sm text-white outline-none"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-400/40"
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
          className="h-12 rounded-2xl border border-white/10 bg-[#0b1727] px-4 text-sm text-white outline-none"
        >
          <option value="MEMBER">MEMBER</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <button
          onClick={handleCreate}
          disabled={loading}
          className={clsx(
            'flex h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
            'border-cyan-400/30 bg-cyan-500/[0.14] text-cyan-100',
            'hover:border-cyan-300/50 hover:bg-cyan-500/[0.22]'
          )}
        >
          <Plus className="h-4 w-4" />
          {loading ? 'Создание...' : 'Создать'}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {invites.map((invite) => {
          const link = `${origin}/accept-invite?token=${invite.token}`

          return (
            <div
              key={invite.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-cyan-200" />

                    <span className="text-sm font-medium text-white">
                      {invite.email}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Shield className="h-3.5 w-3.5" />
                    {invite.role}
                  </div>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(link)
                  }}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/[0.08] px-4 text-sm text-violet-100 transition hover:border-violet-300/40 hover:bg-violet-500/[0.14]"
                >
                  <Copy className="h-4 w-4" />
                  Копировать ссылку
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
