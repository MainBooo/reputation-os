'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCompanySourceTargets, updateCompanySourceTarget } from '@/lib/api/companies'
import { startTelegramSync } from '@/lib/api/telegram-channels'

export default function TelegramMonitoringToggle({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [targetId, setTargetId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCompanySourceTargets(companyId)
      .then((targets: any[]) => {
        if (cancelled) return
        const telegramTarget = targets.find((t) => t.source?.platform === 'TELEGRAM')
        if (telegramTarget) {
          setTargetId(telegramTarget.id)
          setEnabled(telegramTarget.isActive !== false && telegramTarget.syncMentionsEnabled !== false)
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [companyId])

  async function onToggle() {
    if (busy || loading) return
    const next = !enabled
    setBusy(true)
    try {
      if (!targetId) {
        // Never started before — bootstrap creates the target and kicks off DISCOVERY.
        await startTelegramSync(companyId)
      } else {
        await updateCompanySourceTarget(companyId, targetId, {
          syncMentionsEnabled: next,
          isActive: next
        })
      }
      setEnabled(next)
      router.refresh()
    } catch {
      // leave state unchanged on failure (e.g. plan limit) — surfaced via toast elsewhere
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-300">{enabled ? 'Включён' : 'Выключен'}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={busy || loading}
        onClick={onToggle}
        className={[
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition',
          enabled ? 'bg-sky-500' : 'bg-white/15',
          busy || loading ? 'opacity-60 cursor-not-allowed' : ''
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-black transition',
            enabled ? 'translate-x-6' : 'translate-x-1'
          ].join(' ')}
        />
      </button>
    </div>
  )
}
