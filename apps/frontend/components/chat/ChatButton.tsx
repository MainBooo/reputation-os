'use client'

import clsx from 'clsx'
import { MessageSquare } from 'lucide-react'
import { useChatContext } from '@/lib/chat/ChatContext'

export default function ChatButton() {
  const { isOpen, openChat, closeChat, unreadCount } = useChatContext()
  const hasUnread = unreadCount > 0

  function handleClick() {
    if (isOpen) closeChat()
    else openChat()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Командный чат"
      className={clsx(
        'relative inline-flex h-12 w-12 items-center justify-center rounded-[22px] border text-slate-100 shadow-[0_0_28px_rgba(34,211,238,0.10)] transition',
        isOpen
          ? 'border-cyan-300/40 bg-cyan-500/[0.16]'
          : 'border-cyan-400/20 bg-cyan-500/[0.08] hover:border-cyan-300/35 hover:bg-cyan-500/[0.14]'
      )}
    >
      <MessageSquare className="h-5 w-5" />
      {hasUnread ? (
        <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold leading-none text-white shadow-[0_0_10px_rgba(6,182,212,0.9)]">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </button>
  )
}
