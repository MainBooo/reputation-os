'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useChatContext } from '@/lib/chat/ChatContext'

const MAX_LENGTH = 4000

interface Props {
  threadId: string
  onSend: (body: string) => Promise<void>
}

export default function ChatMessageInput({ threadId, onSend }: Props) {
  const { sendTyping } = useChatContext()
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    setError('')

    if (!isTypingRef.current) {
      isTypingRef.current = true
      sendTyping(threadId, true)
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false
      sendTyping(threadId, false)
    }, 2000)
  }

  async function handleSubmit() {
    const body = value.trim()
    if (!body || sending) return

    setSending(true)
    setError('')

    if (isTypingRef.current) {
      isTypingRef.current = false
      sendTyping(threadId, false)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    }

    try {
      await onSend(body)
      setValue('')
      textareaRef.current?.focus({ preventScroll: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить сообщение')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const remaining = MAX_LENGTH - value.length
  const tooLong = remaining < 0

  return (
    <div className="border-t border-white/10 bg-[#07111f] p-3">
      {error ? (
        <div className="mb-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение... (Enter — отправить, Shift+Enter — новая строка)"
          rows={2}
          maxLength={MAX_LENGTH}
          disabled={sending}
          className="min-h-[52px] flex-1 resize-none rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/30 focus:bg-white/[0.06] disabled:opacity-60"
          style={{ maxHeight: '120px' }}
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || tooLong || sending}
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] border border-cyan-400/25 bg-cyan-500/[0.12] text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/[0.20] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {value.length > MAX_LENGTH * 0.8 ? (
        <div className={`mt-1 text-right text-xs ${tooLong ? 'text-red-400' : 'text-slate-500'}`}>
          {remaining < 0 ? `Превышен лимит на ${Math.abs(remaining)} симв.` : `${remaining} симв.`}
        </div>
      ) : null}
    </div>
  )
}
