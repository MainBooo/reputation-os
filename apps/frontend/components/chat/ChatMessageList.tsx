'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { getMessages, sendMessage, editMessage, deleteMessage, markThreadRead } from '@/lib/api/chat'
import { useChatContext } from '@/lib/chat/ChatContext'
import ChatMessageInput from './ChatMessageInput'
import type { ChatMessage } from '@/lib/api/chat'

interface Props {
  threadId: string
  workspaceId: string | null | undefined
  currentUserId: string
  canManage: boolean
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  } catch { return '' }
}

function authorName(msg: ChatMessage) {
  return msg.author?.fullName || msg.author?.email || 'Участник'
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export default function ChatMessageList({ threadId, workspaceId, currentUserId, canManage }: Props) {
  const { onMessage, onMessageUpdated, onMessageDeleted, joinThread, leaveThread, refreshUnread } = useChatContext()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMessages(threadId, workspaceId)
      setMessages(res.messages)
      setNextCursor(res.nextCursor)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [threadId, workspaceId])

  useEffect(() => {
    load()
    joinThread(threadId)
    markThreadRead(threadId, workspaceId).then(refreshUnread).catch(() => {})

    return () => leaveThread(threadId)
  }, [threadId, workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on first load
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading])

  // Real-time events
  useEffect(() => {
    const unsubMsg = onMessage((msg) => {
      if (msg.threadId !== threadId) return
      setMessages((prev) => [...prev, msg])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      markThreadRead(threadId, workspaceId).then(refreshUnread).catch(() => {})
    })

    const unsubUpd = onMessageUpdated((data) => {
      if (data.threadId !== threadId) return
      setMessages((prev) => prev.map((m) => m.id === data.message.id ? data.message : m))
    })

    const unsubDel = onMessageDeleted((data) => {
      if (data.threadId !== threadId) return
      setMessages((prev) => prev.map((m) => m.id === data.messageId ? { ...m, deletedAt: new Date().toISOString() } : m))
    })

    return () => { unsubMsg(); unsubUpd(); unsubDel() }
  }, [threadId, workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await getMessages(threadId, workspaceId, nextCursor)
      setMessages((prev) => [...res.messages, ...prev])
      setNextCursor(res.nextCursor)
    } catch { /* ignore */ } finally {
      setLoadingMore(false)
    }
  }

  async function handleSend(body: string) {
    await sendMessage(threadId, workspaceId, body)
  }

  async function handleEdit(messageId: string) {
    const body = editValue.trim()
    if (!body) return
    try {
      const updated = await editMessage(messageId, workspaceId, body)
      setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m))
      setEditingId(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка редактирования')
    }
  }

  async function handleDelete(messageId: string) {
    if (!confirm('Удалить сообщение?')) return
    setMenuId(null)
    try {
      await deleteMessage(messageId, workspaceId)
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Загрузка сообщений...
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-1">
        {nextCursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="mx-auto mb-3 block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-white disabled:opacity-60"
          >
            {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
          </button>
        ) : null}

        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="text-2xl">💬</span>
            <p className="text-sm font-medium text-slate-300">Пока нет сообщений</p>
            <p className="text-xs text-slate-500">Напишите первое сообщение команде</p>
          </div>
        ) : null}

        {messages.map((msg, i) => {
          const isMine = msg.authorId === currentUserId
          const isDeleted = Boolean(msg.deletedAt)
          const showDate = i === 0 || !isSameDay(messages[i - 1].createdAt, msg.createdAt)
          const showAuthor = i === 0 || messages[i - 1].authorId !== msg.authorId || showDate

          return (
            <div key={msg.id}>
              {showDate ? (
                <div className="my-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs text-slate-500">{formatDate(msg.createdAt)}</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              ) : null}

              <div
                className={`group relative flex items-start gap-2.5 rounded-2xl px-3 py-1.5 transition ${isMine ? 'flex-row-reverse' : ''} hover:bg-white/[0.03]`}
                onClick={() => setMenuId(null)}
              >
                {/* Avatar */}
                {showAuthor && !isMine ? (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-slate-700 text-[11px] font-medium text-slate-200">
                    {authorName(msg).slice(0, 1).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-7 shrink-0" />
                )}

                <div className={`min-w-0 max-w-[80%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {showAuthor ? (
                    <div className={`mb-0.5 flex items-baseline gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-medium text-slate-300">
                        {isMine ? 'Вы' : authorName(msg)}
                      </span>
                      <span className="text-[10px] text-slate-600">{formatTime(msg.createdAt)}</span>
                    </div>
                  ) : null}

                  {editingId === msg.id ? (
                    <div className="w-full">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(msg.id) }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="w-full resize-none rounded-xl border border-cyan-400/30 bg-[#0b1728] px-3 py-2 text-sm text-white outline-none"
                        rows={2}
                        autoFocus
                      />
                      <div className="mt-1 flex gap-2 text-xs">
                        <button onClick={() => handleEdit(msg.id)} className="text-cyan-400 hover:text-cyan-300">Сохранить</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-300">Отмена</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        isDeleted
                          ? 'border border-white/5 bg-white/[0.025] italic text-slate-600'
                          : isMine
                          ? 'border border-cyan-400/15 bg-cyan-500/[0.12] text-slate-100'
                          : 'border border-white/10 bg-white/[0.05] text-slate-200'
                      }`}
                    >
                      {isDeleted ? (
                        <span>Сообщение удалено</span>
                      ) : (
                        <>
                          <span className="whitespace-pre-wrap break-words">{msg.body}</span>
                          {msg.editedAt ? (
                            <span className="ml-2 text-[10px] text-slate-600">Изменено</span>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isDeleted && editingId !== msg.id && (isMine || canManage) ? (
                  <div className={`absolute top-1 ${isMine ? 'left-1' : 'right-1'} hidden group-hover:flex items-center gap-1`}>
                    {isMine ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingId(msg.id); setEditValue(msg.body) }}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-[#0b1728] text-slate-400 hover:text-white"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(msg.id) }}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-[#0b1728] text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      <ChatMessageInput threadId={threadId} onSend={handleSend} />
    </div>
  )
}
