'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { runBrandSearch, runCommunitySync, runOwnedCommunitySync, runVkPostSearch } from '@/lib/api/vk'

export default function VkActions({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function run(action: 'post-search' | 'brand' | 'community' | 'owned') {
    setLoading(action)
    setMessage('')

    try {
      if (action === 'post-search') {
        const result = await runVkPostSearch(companyId) as { jobId?: string | null }
        setMessage(`Playwright-поиск постов VK запущен${result?.jobId ? ` · job ${result.jobId}` : ''}`)
      }

      if (action === 'brand') {
        const result = await runBrandSearch(companyId) as { jobsCount?: number }
        setMessage(`Глобальный прогон по открытому VK запущен${result?.jobsCount ? `: ${result.jobsCount} задач` : ''}`)
      }

      if (action === 'community') {
        const result = await runCommunitySync(companyId) as { jobsCount?: number }
        setMessage(`Прогон по выбранным сообществам запущен${result?.jobsCount ? `: ${result.jobsCount} задач` : ''}`)
      }

      if (action === 'owned') {
        const result = await runOwnedCommunitySync(companyId) as { jobsCount?: number }
        setMessage(`Прогон по собственному сообществу запущен${result?.jobsCount ? `: ${result.jobsCount} задач` : ''}`)
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
        <Button onClick={() => run('post-search')} disabled={loading !== null}>
          {loading === 'post-search' ? 'Запуск...' : 'Запустить поиск постов VK'}
        </Button>

        <Button variant="secondary" onClick={() => run('brand')} disabled={loading !== null}>
          {loading === 'brand' ? 'Запуск...' : 'Прогнать весь открытый VK'}
        </Button>

        <Button variant="secondary" onClick={() => run('community')} disabled={loading !== null}>
          {loading === 'community' ? 'Запуск...' : 'Прогнать выбранные сообщества'}
        </Button>

        <Button variant="secondary" onClick={() => run('owned')} disabled={loading !== null}>
          {loading === 'owned' ? 'Запуск...' : 'Прогнать своё сообщество'}
        </Button>
      </div>

      {message ? <div className="text-sm text-muted">{message}</div> : null}
    </div>
  )
}
