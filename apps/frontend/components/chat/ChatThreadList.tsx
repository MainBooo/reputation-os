'use client'

import clsx from 'clsx'
import { MessageSquare, Building2, FileText } from 'lucide-react'
import type { ChatThread } from '@/lib/api/chat'

interface Props {
  threads: ChatThread[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
}

function threadIcon(type: ChatThread['type']) {
  if (type === 'COMPANY') return <Building2 className="h-4 w-4 shrink-0" />
  if (type === 'MENTION') return <FileText className="h-4 w-4 shrink-0" />
  return <MessageSquare className="h-4 w-4 shrink-0" />
}

function threadLabel(thread: ChatThread) {
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

const SECTION_ORDER: ChatThread['type'][] = ['WORKSPACE', 'COMPANY', 'MENTION']
const SECTION_LABELS: Record<ChatThread['type'], string> = {
  WORKSPACE: 'Рабочее пространство',
  COMPANY: 'Компании',
  MENTION: 'Отзывы'
}

export default function ChatThreadList({ threads, selectedId, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="p-3 text-sm text-slate-500">Загрузка...</div>
    )
  }

  if (!threads.length) {
    return (
      <div className="p-4 text-center text-sm text-slate-500">
        Нет активных обсуждений
      </div>
    )
  }

  const grouped = SECTION_ORDER.reduce<Record<ChatThread['type'], ChatThread[]>>(
    (acc, type) => {
      acc[type] = threads.filter((t) => t.type === type)
      return acc
    },
    { WORKSPACE: [], COMPANY: [], MENTION: [] }
  )

  return (
    <div className="flex flex-col gap-1 p-2">
      {SECTION_ORDER.map((type) => {
        const items = grouped[type]
        if (!items.length) return null

        return (
          <div key={type}>
            {type !== 'WORKSPACE' ? (
              <div className="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {SECTION_LABELS[type]}
              </div>
            ) : null}

            {items.map((thread) => {
              const isActive = thread.id === selectedId
              const preview = lastMessagePreview(thread)
              const hasUnread = thread.unreadCount > 0

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
                          {threadLabel(thread)}
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
            })}
          </div>
        )
      })}
    </div>
  )
}
