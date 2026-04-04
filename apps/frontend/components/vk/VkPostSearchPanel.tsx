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
  runs,
  sessionConnected
}: {
  companyId: string
  initialProfile: SearchProfile
  runs: any[]
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
    <div className="grid gap-6">
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

        <div className="mt-5 rounded-xl border border-line bg-panel2 p-4">
          <div className="text-sm text-muted">
            Для запуска используется сохранённый профиль компании и её алиасы.
            {!sessionConnected ? ' Сначала нужно подключить VK-сессию.' : ''}
          </div>
        </div>

        {error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}
        {message ? <div className="mt-4 text-sm text-emerald-400">{message}</div> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" disabled={running || !sessionConnected} onClick={runSearch}>
            {running ? 'Запуск...' : 'Запустить поиск постов VK'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-base font-semibold text-brand">Последние запуски</div>
        <div className="mt-1 text-sm text-muted">
          Последние попытки запуска VK-поиска без технических деталей очереди.
        </div>

        <div className="mt-4 space-y-3">
          {runs.length ? (
            runs.map((run) => (
              <div key={run.id} className="rounded-xl border border-line bg-panel2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={run.jobStatus}>{run.jobStatus || 'UNKNOWN'}</Badge>
                </div>

                <div className="mt-3 text-sm text-muted">
                  {run.createdAt ? new Date(run.createdAt).toLocaleString() : 'Время запуска неизвестно'}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted">Запусков пока не было.</div>
          )}
        </div>
      </Card>
    </div>
  )
}
