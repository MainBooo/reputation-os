'use client'

import clsx from 'clsx'
import { MessageSquare, Building2, FileText, User } from 'lucide-react'
import type { ChatThread } from '@/lib/api/chat'

interface Props {
  threads: ChatThread[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
  currentUserId?: string
}

function threadIcon(type: ChatThread['type']) {
  if (type === 'COMPANY') return <Building2 className="h-4 w-4 shrink-0" />
  if (type === 'MENTION') return <FileText className="h-4 w-4 shrink-0" />
  if (type === 'DIRECT') return <User className="h-4 w-4 shrink-0" />
  return <MessageSquare className="h-4 w-4 shrink-0" />
}

function threadLabel(thread: ChatThread, currentUserId?: string) {
  if (thread.type === 'DIRECT') {
    const other = thread.participants?.find((p) => p.userId !== currentUserId)
    return other?.user?.fullName || other?.user?.email || 'Личный чат'
  }
  if (thread.title) return thread.title
  if (thread.type === 'WORKSPACE') return 'Общий чат'
  if (thread.type === 'COMPANY') return thread.company?.name || 'Компания'
  if (thread.type === 'MENTION') return thread.mention?.preview || 'Обсуждение отзыва'
  return 'Чат'
}

function formatTime(iso?: string | null) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  } catch { return '' }
}

function lastMessagePreview(thread: ChatThread) {
  if (!thread.lastMessage) return null
  const msg = thread.lastMessage
  if (msg.deletedAt) return 'Сообщение удалено'
  return msg.body?.slice(0, 60) ?? null
}

type SectionType = 'WORKSPACE' | 'COMPANY' | 'MENTION' | 'DIRECT'

const WORKSPACE_ORDER: SectionType[] = ['WORKSPACE', 'COMPANY', 'MENTION']
const WORKSPACE_SECTION_LABELS: Record<SectionType, string> = {
  WORKSPACE: 'Общий чат',
  COMPANY: 'Компании',
  MENTION: 'Отзывы',
  DIRECT: 'Личные сообщения'
}

export default function ChatThreadList({ threads, selectedId, onSelect, loading, currentUserId }: Props) {
  if (loading) {
    return (
      <div className="p-3 text-sm text-slate-500">Загрузка...</div>
    )
  }

  const workspaceThreads = WORKSPACE_ORDER.reduce<Record<SectionType, ChatThread[]>>(
    (acc, type) => {
      acc[type] = threads.filter((t) => t.type === type)
      return acc
    },
    { WORKSPACE: [], COMPANY: [], MENTION: [], DIRECT: [] }
  )
  workspaceThreads.DIRECT = threads.filter((t) => t.type === 'DIRECT')

  const hasWorkspace = WORKSPACE_ORDER.some((t) => workspaceThreads[t].length > 0)
  const hasDirect = workspaceThreads.DIRECT.length > 0

  if (!hasWorkspace && !hasDirect) {
    return (
      <div className="p-4 text-center text-sm text-slate-500">
        Нет активных обсуждений
      </div>
    )
  }

  function renderThread(thread: ChatThread) {
    const isActive = thread.id === selectedId
    const preview = lastMessagePreview(thread)
    const hasUnread = thread.unreadCount > 0
    const label = threadLabel(thread, currentUserId)

    return (
      <button
        key={thread.id}
        type="button"
        onClick={() => onSelect(thread.id)}
        className={clsx(
          'w-full rounded-2xl border px-3 py-2.5 text-left transition',
          isActive
            ? 'border-cyan-400/30 bg-cyan-500/[0.12]'
            : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
        )}
      >
        <div className="flex items-start gap-2">
          <span className={clsx('mt-0.5 text-slate-400', isActive && 'text-cyan-300')}>
            {threadIcon(thread.type)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className={clsx(
                'truncate text-sm font-medium',
                isActive ? 'text-white' : hasUnread ? 'text-white' : 'text-slate-300'
              )}>
                {label}
              </span>

              <div className="flex shrink-0 items-center gap-1.5">
                {hasUnread ? (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-white">
                    {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                  </span>
                ) : null}
                <span className="text-[10px] text-slate-600">
                  {formatTime(thread.lastMessageAt)}
                </span>
              </div>
            </div>

            {preview ? (
              <p className={clsx('mt-0.5 truncate text-xs', hasUnread ? 'text-slate-300' : 'text-slate-500')}>
                {preview}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-600">Нет сообщений</p>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {/* Рабочее пространство */}
      {hasWorkspace ? (
        <div>
          <div className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Рабочее пространство
          </div>
          {WORKSPACE_ORDER.map((type) => {
            const items = workspaceThreads[type]
            if (!items.length) return null
            return (
              <div key={type}>
                {type !== 'WORKSPACE' ? (
                  <div className="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-700">
                    {WORKSPACE_SECTION_LABELS[type]}
                  </div>
                ) : null}
                {items.map(renderThread)}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Личные сообщения */}
      {hasDirect ? (
        <div className={hasWorkspace ? 'mt-3' : ''}>
          <div className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Личные сообщения
          </div>
          {workspaceThreads.DIRECT.map(renderThread)}
        </div>
      ) : null}
    </div>
  )
}
