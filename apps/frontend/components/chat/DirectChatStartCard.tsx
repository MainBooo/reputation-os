'use client'

import { useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { createDirectChat } from '@/lib/api/chat'
import { useChatContext } from '@/lib/chat/ChatContext'

export default function DirectChatStartCard() {
  const { openChat, setSelectedThreadId } = useChatContext()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const thread = await createDirectChat(trimmed)
      setSelectedThreadId(thread.id)
      openChat()
      setEmail('')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        const msg = (err as { message: string }).message
        if (msg.includes('не найден')) {
          setError('Пользователь с таким email не найден.')
        } else if (msg.includes('самим собой')) {
          setError('Нельзя создать чат с самим собой.')
        } else {
          setError(msg || 'Произошла ошибка.')
        }
      } else {
        setError('Произошла ошибка.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/[0.08]">
          <MessageSquare className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Написать пользователю</div>
          <div className="text-xs text-slate-500">Начните личный диалог по email</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null) }}
          placeholder="Email пользователя"
          disabled={loading}
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/40 focus:bg-white/[0.06] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/[0.10] text-cyan-400 transition hover:border-cyan-400/40 hover:bg-cyan-500/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Начать чат"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {error ? (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  )
}
