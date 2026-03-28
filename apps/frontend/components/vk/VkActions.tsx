'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { runBrandSearch, runCommunitySync, runOwnedCommunitySync } from '@/lib/api/vk'

export default function VkActions({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState<string | null>(null)

  async function run(action: 'brand' | 'community' | 'owned') {
    setLoading(action)
    try {
      if (action === 'brand') await runBrandSearch(companyId)
      if (action === 'community') await runCommunitySync(companyId)
      if (action === 'owned') await runOwnedCommunitySync(companyId)
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => run('brand')} disabled={loading !== null}>
        {loading === 'brand' ? 'Running...' : 'Run brand search'}
      </Button>
      <Button variant="secondary" onClick={() => run('community')} disabled={loading !== null}>
        {loading === 'community' ? 'Running...' : 'Run community sync'}
      </Button>
      <Button onClick={() => run('owned')} disabled={loading !== null}>
        {loading === 'owned' ? 'Running...' : 'Run owned community sync'}
      </Button>
    </>
  )
}
