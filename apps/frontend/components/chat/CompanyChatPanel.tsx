'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { getOrCreateCompanyThread } from '@/lib/api/chat'
import { me } from '@/lib/api/auth'
import { useChatContext } from '@/lib/chat/ChatContext'
import ChatMessageList from './ChatMessageList'
import type { ChatThread } from '@/lib/api/chat'

interface Props {
  companyId: string
  workspaceId: string
}

export default function CompanyChatPanel({ companyId, workspaceId }: Props) {
  const { setWorkspaceId, refreshUnread } = useChatContext()
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [canManage, setCanManage] = useState(false)

  useEffect(() => {
    setWorkspaceId(workspaceId)
    me().then((user) => {
      setCurrentUserId(user.id)
      setCanManage(user.systemRole === 'SUPER_ADMIN')
    }).catch(() => {})
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openPanel() {
    if (expanded) { setExpanded(false); return }

    if (!thread) {
      setLoading(true)
      try {
        const data = await getOrCreateCompanyThread(companyId, workspaceId)
        setThread(data)
        setExpanded(true)
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    } else {
      setExpanded(true)
    }
  }

  return (
    <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-[#07111f]">
      <button
        type="button"
        onClick={openPanel}
        disabled={loading}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] border border-cyan-400/20 bg-cyan-500/[0.10]">
          <MessageSquare className="h-4 w-4 text-cyan-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">Обсуждение компании</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {loading ? 'Загрузка...' : 'Командный чат по этой компании'}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>

      {expanded && thread ? (
        <div className="flex h-[420px] flex-col border-t border-white/10">
          <ChatMessageList
            threadId={thread.id}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            canManage={canManage}
          />
        </div>
      ) : null}
    </div>
  )
}
