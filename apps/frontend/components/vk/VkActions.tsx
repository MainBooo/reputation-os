'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { runVkPostSearch } from '@/lib/api/vk'

export default function VkActions({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function run() {
    setLoading(true)
    setMessage('')

    try {
      const result = (await runVkPostSearch(companyId)) as { jobId?: string | null }
      setMessage(`Поиск постов VK запущен${result?.jobId ? ` · job ${result.jobId}` : ''}`)
      router.refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось запустить поиск постов VK')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button onClick={run} disabled={loading}>
          {loading ? 'Запуск...' : 'Запустить поиск постов VK'}
        </Button>
      </div>

      {message ? <div className="text-sm text-muted">{message}</div> : null}
    </div>
  )
}
