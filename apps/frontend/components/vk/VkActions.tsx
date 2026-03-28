'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { runBrandSearch, runCommunitySync, runOwnedCommunitySync } from '@/lib/api/vk'

export default function VkActions({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function run(action: 'brand' | 'community' | 'owned') {
    setLoading(action)
    setMessage('')

    try {
      if (action === 'brand') {
        const result = await runBrandSearch(companyId) as { jobsCount?: number }
        setMessage(`Поиск по бренду запущен${result?.jobsCount ? `: ${result.jobsCount} задач` : ''}`)
      }

      if (action === 'community') {
        const result = await runCommunitySync(companyId) as { jobsCount?: number }
        setMessage(`Синхронизация сообществ запущена${result?.jobsCount ? `: ${result.jobsCount} задач` : ''}`)
      }

      if (action === 'owned') {
        const result = await runOwnedCommunitySync(companyId) as { jobsCount?: number }
        setMessage(`Синхронизация своего сообщества запущена${result?.jobsCount ? `: ${result.jobsCount} задач` : ''}`)
      }

      router.refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось запустить задачу')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => run('brand')} disabled={loading !== null}>
          {loading === 'brand' ? 'Запуск...' : 'Запустить поиск по бренду'}
        </Button>

        <Button variant="secondary" onClick={() => run('community')} disabled={loading !== null}>
          {loading === 'community' ? 'Запуск...' : 'Синхронизировать сообщества'}
        </Button>

        <Button onClick={() => run('owned')} disabled={loading !== null}>
          {loading === 'owned' ? 'Запуск...' : 'Синхронизировать своё сообщество'}
        </Button>
      </div>

      {message ? <div className="text-sm text-muted">{message}</div> : null}
    </div>
  )
}
