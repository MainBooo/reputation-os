'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, X } from 'lucide-react'
import { getThreads, getDirectPartner } from '@/lib/api/chat'
import { me } from '@/lib/api/auth'
import { useChatContext } from '@/lib/chat/ChatContext'
import ChatThreadList from './ChatThreadList'
import ChatMessageList from './ChatMessageList'
import type { ChatThread } from '@/lib/api/chat'

export default function ChatDrawer() {
  const { isOpen, closeChat, selectedThreadId, setSelectedThreadId, workspaceId, onUnreadUpdated } = useChatContext()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [canManage, setCanManage] = useState(false)

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null

  // Clear threads when drawer closes
  useEffect(() => {
    if (!isOpen) setThreads([])
  }, [isOpen])

  useEffect(() => {
    me().then((user) => {
      setCurrentUserId(user.id)
      setCanManage(user.systemRole === 'SUPER_ADMIN')
    }).catch(() => {})
  }, [])

  async function loadThreads() {
    if (!workspaceId) return
    setLoadingThreads(true)
    try {
      const data = await getThreads(workspaceId)
      setThreads(Array.isArray(data) ? data : [])
    } catch { /* ignore */ } finally {
      setLoadingThreads(false)
    }
  }

  useEffect(() => {
    if (isOpen && workspaceId) loadThreads()
  }, [isOpen, workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh thread list on new messages (update unread badges)
  useEffect(() => {
    return onUnreadUpdated(() => {
      if (isOpen && workspaceId) loadThreads()
    })
  }, [isOpen, workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId)
    setThreads((prev) => prev.map((t) => t.id === threadId ? { ...t, unreadCount: 0 } : t))
  }

  function getThreadTitle(thread: ChatThread): string {
    if (thread.type === 'DIRECT') {
      const partner = getDirectPartner(thread, currentUserId)
      return partner?.fullName || partner?.email || 'Личный чат'
    }
    if (thread.title) return thread.title
    if (thread.type === 'WORKSPACE') return 'Общий чат'
    if (thread.type === 'COMPANY') return thread.company?.name ?? 'Компания'
    return 'Обсуждение отзыва'
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
        onClick={closeChat}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-[80] flex h-full w-full flex-col overflow-hidden border-l border-white/10 bg-[#050b12] shadow-[−28px_0_90px_rgba(0,0,0,0.78)] sm:w-[520px]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-[#07111f] px-4 py-4">
          {selectedThreadId ? (
            <button
              type="button"
              onClick={() => setSelectedThreadId(null)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-white/20 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}

          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">
              {selectedThread ? getThreadTitle(selectedThread) : 'Сообщения'}
            </div>
            {selectedThread?.type === 'COMPANY' && selectedThread.company ? (
              <div className="mt-0.5 text-xs text-slate-500">{selectedThread.company.name}</div>
            ) : null}
            {selectedThread?.type === 'MENTION' && selectedThread.mention ? (
              <div className="mt-0.5 truncate text-xs text-slate-500">{selectedThread.mention.preview}</div>
            ) : null}
            {selectedThread?.type === 'DIRECT' ? (
              <div className="mt-0.5 text-xs text-slate-500">Личный диалог</div>
            ) : null}
          </div>

          {selectedThread?.type === 'MENTION' && selectedThread.companyId && selectedThread.mentionId ? (
            <Link
              href={`/companies/${selectedThread.companyId}/inbox?mentionId=${selectedThread.mentionId}`}
              onClick={closeChat}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.10] px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:border-cyan-400/45 hover:bg-cyan-500/[0.18]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              К отзыву
            </Link>
          ) : null}

          <button
            type="button"
            onClick={closeChat}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedThreadId ? (
            <ChatMessageList
              threadId={selectedThreadId}
              workspaceId={selectedThread?.workspaceId ?? null}
              currentUserId={currentUserId}
              canManage={canManage && selectedThread?.type !== 'DIRECT'}
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              <ChatThreadList
                threads={threads}
                selectedId={null}
                onSelect={handleSelectThread}
                loading={loadingThreads || (isOpen && !workspaceId)}
                currentUserId={currentUserId}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
