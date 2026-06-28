'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X, Sparkles } from 'lucide-react'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'
import { isSubscriptionActive } from '@/lib/api/billing'
import { WORKSPACE_STORAGE_KEY } from '@/lib/workspace-selection'

const BLOCKED_PATHS = ['/billing', '/settings', '/team', '/admin']

function getTodayKey(workspaceId: string) {
  const today = new Date().toISOString().slice(0, 10)
  return `subscription_prompt_seen_${workspaceId}_${today}`
}

export default function SubscriptionPopup() {
  const pathname = usePathname()
  const router = useRouter()
  const { entitlements, loading } = useSubscription()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (loading) return
    if (isSubscriptionActive(entitlements)) return
    if (BLOCKED_PATHS.some((p) => pathname.startsWith(p))) return

    const workspaceId = localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? 'default'
    const key = getTodayKey(workspaceId)

    if (typeof window !== 'undefined' && !localStorage.getItem(key)) {
      const timer = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [loading, entitlements, pathname])

  function dismiss() {
    const workspaceId = localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? 'default'
    const key = getTodayKey(workspaceId)
    if (typeof window !== 'undefined') localStorage.setItem(key, '1')
    setVisible(false)
  }

  function handleUpgrade() {
    dismiss()
    router.push('/billing/checkout')
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 w-full max-w-sm">
      <div className="relative overflow-hidden rounded-[24px] border border-cyan-400/20 bg-[#0b111c] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.50),0_0_40px_rgba(34,211,238,0.08)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.10),transparent_45%)]" />

        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-500 transition hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="relative flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Активируйте тариф</div>
            <div className="mt-1 text-xs leading-5 text-zinc-400">
              Мониторинг, AI-ответы и уведомления доступны после выбора тарифа.
            </div>
          </div>
        </div>

        <div className="relative mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleUpgrade}
            className="flex-1 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110"
          >
            Выбрать тариф
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  )
}
