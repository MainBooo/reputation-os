'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCompanySourceTarget } from '@/lib/api/companies'

export default function WebMonitoringToggle({
  companyId,
  rootTargetId,
  initialEnabled
}: {
  companyId: string
  rootTargetId: string
  initialEnabled: boolean
}) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)

  async function onToggle() {
    if (loading) return
    const next = !enabled
    setEnabled(next)
    setLoading(true)
    try {
      await updateCompanySourceTarget(companyId, rootTargetId, {
        syncMentionsEnabled: next,
        isActive: next
      })
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
        disabled={loading}
        onClick={onToggle}
        className={[
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition',
          enabled ? 'bg-brand' : 'bg-white/15',
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
