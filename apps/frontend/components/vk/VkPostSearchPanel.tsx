'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { runVkPostSearch } from '@/lib/api/vk'

type SearchProfile = {
  includeKeywords: string[]
  excludeKeywords: string[]
  contextKeywords: string[]
  geoKeywords: string[]
  category: string | null
}

export default function VkPostSearchPanel({
  companyId,
  initialProfile,
  sessionConnected
}: {
  companyId: string
  initialProfile: SearchProfile
  sessionConnected: boolean
}) {
  const router = useRouter()

  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const totalKeywords = useMemo(
    () =>
      (initialProfile?.includeKeywords?.length || 0) +
      (initialProfile?.excludeKeywords?.length || 0) +
      (initialProfile?.contextKeywords?.length || 0) +
      (initialProfile?.geoKeywords?.length || 0),
    [initialProfile]
  )

  async function runSearch() {
    if (!sessionConnected) {
      setMessage('')
      setError('Сначала подключите VK, затем запускайте поиск')
      return
    }

    setRunning(true)
    setMessage('')
    setError('')

    try {
      await runVkPostSearch(companyId)
      setMessage('Поиск постов VK запущен')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось запустить поиск постов VK')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-brand">Поиск упоминаний в VK</div>
          <div className="mt-1 text-sm text-muted">
            Используется текущий Playwright-поиск по названию и алиасам компании.
          </div>
        </div>

        <Badge>{`Профиль: ${totalKeywords > 0 ? 'настроен' : 'базовый режим'}`}</Badge>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-panel2 p-4">
        <div className="text-sm text-muted">
          Для запуска используется сохранённый профиль компании и её алиасы.
          {!sessionConnected ? ' Сначала нужно подключить VK-сессию.' : ''}
        </div>
      </div>

      {error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}
      {message ? <div className="mt-4 text-sm text-emerald-400">{message}</div> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" disabled={running || !sessionConnected} onClick={runSearch}>
          {running ? 'Запуск...' : 'Запустить поиск постов VK'}
        </Button>
      </div>
    </Card>
  )
}
