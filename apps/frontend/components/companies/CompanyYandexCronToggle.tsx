'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCompanySourceTarget } from '@/lib/api/companies'

export default function CompanyYandexCronToggle({
  companyId,
  targetId,
  initialEnabled
}: {
  companyId: string
  targetId: string
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
      await updateCompanySourceTarget(companyId, targetId, {
        syncReviewsEnabled: next
      })
      router.refresh()
    } catch (e) {
      setEnabled(!next)
      alert(e instanceof Error ? e.message : 'Не удалось обновить режим автообновления')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel2/40 p-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">Автообновление Яндекс Карт</div>
        <div className="mt-1 text-xs text-muted">
          Cron-проверка новых отзывов каждые 10 минут.
        </div>
      </div>

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
