'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { getOrCreateMentionThread } from '@/lib/api/chat'
import { me } from '@/lib/api/auth'
import { useChatContext } from '@/lib/chat/ChatContext'
import ChatMessageList from './ChatMessageList'
import type { ChatThread } from '@/lib/api/chat'

interface Props {
  mentionId: string
  workspaceId: string
}

export default function MentionChatPanel({ mentionId, workspaceId }: Props) {
  const { setWorkspaceId } = useChatContext()
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
        const data = await getOrCreateMentionThread(mentionId, workspaceId)
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
    <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#07111f]">
      <button
        type="button"
        onClick={openPanel}
        disabled={loading}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] border border-violet-400/20 bg-violet-500/[0.10]">
          <MessageSquare className="h-3.5 w-3.5 text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white">
            {loading ? 'Загрузка...' : 'Обсуждение отзыва'}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Согласуйте ответ с командой</div>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        )}
      </button>

      {expanded && thread ? (
        <div className="flex h-[360px] flex-col border-t border-white/10">
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
