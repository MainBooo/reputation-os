'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getMyEntitlements, isSubscriptionActive, type BillingEntitlements } from '@/lib/api/billing'
import { useChatContext } from '@/lib/chat/ChatContext'

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
  const { workspaceId } = useChatContext()
  const [entitlements, setEntitlements] = useState<BillingEntitlements | null>(null)
  const [loading, setLoading] = useState(true)
  const requestSequence = useRef(0)

  const load = useCallback(() => {
    const sequence = ++requestSequence.current
    setEntitlements(null)

    if (!workspaceId) {
      setLoading(false)
      return
    }

    setLoading(true)
    getMyEntitlements(workspaceId)
      .then((data) => {
        if (requestSequence.current === sequence) setEntitlements(data)
      })
      .catch(() => {
        if (requestSequence.current === sequence) setEntitlements(null)
      })
      .finally(() => {
        if (requestSequence.current === sequence) setLoading(false)
      })
  }, [workspaceId])

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
