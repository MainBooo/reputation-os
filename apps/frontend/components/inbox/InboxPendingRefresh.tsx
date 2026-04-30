'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCompanyMentions } from '@/lib/api/mentions'

export default function InboxPendingRefresh({
  companyId,
  enabled,
  onTimeout
}: {
  companyId: string
  enabled: boolean
  onTimeout?: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 12

    const interval = window.setInterval(async () => {
      attempts += 1

      try {
        const response = await getCompanyMentions(companyId, '?page=1&limit=1')
        const items = Array.isArray(response?.data) ? response.data : []

        if (!cancelled && items.length > 0) {
          window.clearInterval(interval)
          router.refresh()
          return
        }
      } catch {
        // silent retry
      }

      if (!cancelled && attempts >= maxAttempts) {
        window.clearInterval(interval)
        onTimeout?.()
      }
    }, 15000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [companyId, enabled, onTimeout, router])

  return null
}
