'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMetrica } from 'next-yandex-metrica'
import { updateCompanySourceTarget } from '@/lib/api/companies'

type RootTarget = { id: string; syncMentionsEnabled?: boolean }

export default function WebMonitoringToggle({
  companyId,
  rootTargets,
}: {
  companyId: string
  rootTargets: RootTarget[]
}) {
  const router = useRouter()
  const { reachGoal } = useMetrica()
  const initialEnabled = rootTargets.some((t) => t.syncMentionsEnabled !== false)
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)

  async function onToggle() {
    if (loading || !rootTargets.length) return
    const next = !enabled
    setEnabled(next)
    setLoading(true)
    try {
      await Promise.all(
        rootTargets.map((t) =>
          updateCompanySourceTarget(companyId, t.id, {
            syncMentionsEnabled: next,
            isActive: next
          })
        )
      )
      if (next) reachGoal('monitoring_enabled')
      router.refresh()
    } catch {
      setEnabled(!next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-300">
        {enabled ? '\u0412\u043a\u043b\u044e\u0447\u0451\u043d' : '\u0412\u044b\u043a\u043b\u044e\u0447\u0435\u043d'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={loading || !rootTargets.length}
        onClick={onToggle}
        className={[
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition',
          enabled ? 'bg-cyan-500' : 'bg-white/15',
          loading ? 'opacity-60 cursor-not-allowed' : ''
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
