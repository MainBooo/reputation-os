'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Bell, Check, X } from 'lucide-react'
import { getNotifications, markAllNotificationsRead, type AppNotification } from '@/lib/api/notifications'
import { acceptWorkspaceInviteById, declineWorkspaceInvite } from '@/lib/api/workspaces'

function formatDate(value?: string | null) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit'
    })
  } catch {
    return ''
  }
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState('')
  const [message, setMessage] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  const hasUnread = unreadCount > 0
  const workspaceInvites = useMemo(
    () => items.filter((item) => item.type === 'WORKSPACE_INVITE' && !item.readAt),
    [items]
  )

  async function load() {
    setLoading(true)
    setMessage('')

    try {
      const data = await getNotifications()
      setItems(Array.isArray(data?.items) ? data.items : [])
      setUnreadCount(Number(data?.unreadCount || 0))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось загрузить уведомления.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = window.setInterval(load, 30000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function handleOpen() {
    const nextOpen = !open
    setOpen(nextOpen)

    if (nextOpen) {
      await load()
    }
  }

  async function handleAccept(inviteId: string) {
    setActionId(inviteId)
    setMessage('')

    try {
      await acceptWorkspaceInviteById(inviteId)
      setMessage('Приглашение принято.')
      await load()
      window.location.reload()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось принять приглашение.')
    } finally {
      setActionId('')
    }
  }

  async function handleDecline(inviteId: string) {
    setActionId(inviteId)
    setMessage('')

    try {
      await declineWorkspaceInvite(inviteId)
      setMessage('Приглашение отклонено.')
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось отклонить приглашение.')
    } finally {
      setActionId('')
    }
  }

  async function handleReadAll() {
    try {
      await markAllNotificationsRead()
      await load()
    } catch {
      // ignore
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className={clsx(
          'relative inline-flex h-12 w-12 items-center justify-center rounded-[22px] border text-slate-100 shadow-[0_0_28px_rgba(34,211,238,0.10)] transition',
          open
            ? 'border-cyan-300/40 bg-cyan-500/[0.16]'
            : 'border-cyan-400/20 bg-cyan-500/[0.08] hover:border-cyan-300/35 hover:bg-cyan-500/[0.14]'
        )}
        aria-label="Уведомления"
      >
        <Bell className="h-5 w-5" />
        {hasUnread ? (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.95)]" />
        ) : null}
      </button>

      {open ? (
        <div className="fixed left-4 right-4 top-36 z-[80] overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-[420px] rounded-[28px] border border-white/10 bg-[#07111f] shadow-[0_28px_90px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl">
          <div className="border-b border-white/10 bg-[#0b1728] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Уведомления</div>
                <div className="mt-1 text-xs text-slate-400">
                  {unreadCount ? `${unreadCount} новых событий` : 'Новых событий нет'}
                </div>
              </div>

              <button
                type="button"
                onClick={handleReadAll}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-300/25 hover:text-white"
              >
                Прочитано
              </button>
            </div>
          </div>

          <div className="max-h-[460px] overflow-y-auto p-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                Загружаем...
              </div>
            ) : workspaceInvites.length ? (
              <div className="space-y-3">
                {workspaceInvites.map((item) => {
                  const inviteId = item.data?.inviteId
                  const workspaceName = item.data?.workspaceName || 'workspace'
                  const role = item.data?.role || 'MEMBER'
                  const disabled = !inviteId || actionId === inviteId

                  return (
                    <div key={item.id} className="rounded-2xl border border-cyan-300/15 bg-[#0b1728] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{item.title}</div>
                          <div className="mt-1 text-sm leading-5 text-slate-300">
                            Вас пригласили в «{workspaceName}» с ролью {role === 'ADMIN' ? 'Админ' : 'Участник'}.
                          </div>
                          <div className="mt-2 text-xs text-slate-500">{formatDate(item.createdAt)}</div>
                        </div>

                        {!item.readAt ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleAccept(inviteId)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/[0.10] text-sm font-medium text-emerald-100 transition hover:border-emerald-300/35 hover:bg-emerald-500/[0.16] disabled:opacity-60"
                        >
                          <Check className="h-4 w-4" />
                          Принять
                        </button>

                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleDecline(inviteId)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/[0.08] text-sm font-medium text-red-100 transition hover:border-red-300/35 hover:bg-red-500/[0.14] disabled:opacity-60"
                        >
                          <X className="h-4 w-4" />
                          Отказать
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                Пока нет уведомлений.
              </div>
            )}

            {message ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-[#0b1728] px-4 py-3 text-sm text-slate-300">
                {message}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
