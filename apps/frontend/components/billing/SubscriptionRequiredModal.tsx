'use client'

import { useRouter } from 'next/navigation'
import { Lock, X } from 'lucide-react'

interface SubscriptionRequiredModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
}

export default function SubscriptionRequiredModal({
  open,
  onClose,
  title = 'Функция доступна после активации тарифа',
  description = 'Подключите тариф, чтобы использовать мониторинг отзывов, уведомления и AI-инструменты.',
}: SubscriptionRequiredModalProps) {
  const router = useRouter()

  if (!open) return null

  function handleUpgrade() {
    router.push('/billing/checkout')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#0b111c] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.55),0_0_60px_rgba(34,211,238,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:bg-white/[0.10] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[20px] border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
          <Lock className="h-6 w-6" />
        </div>

        <div className="text-xl font-semibold tracking-[-0.03em] text-white">{title}</div>
        <div className="mt-2 text-sm leading-6 text-zinc-400">{description}</div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleUpgrade}
            className="flex-1 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] py-3 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110"
          >
            Выбрать тариф
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.09] hover:text-white"
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  )
}
