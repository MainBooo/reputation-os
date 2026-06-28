'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getMyEntitlements, isSubscriptionActive, type BillingEntitlements } from '@/lib/api/billing'

interface SubscriptionContextValue {
  entitlements: BillingEntitlements | null
  loading: boolean
  refresh: () => void
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  entitlements: null,
  loading: true,
  refresh: () => {},
})

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [entitlements, setEntitlements] = useState<BillingEntitlements | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getMyEntitlements()
      .then((data) => setEntitlements(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <SubscriptionContext.Provider value={{ entitlements, loading, refresh: load }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}

export function useIsSubscriptionActive(): boolean {
  const { entitlements } = useSubscription()
  return isSubscriptionActive(entitlements)
}
