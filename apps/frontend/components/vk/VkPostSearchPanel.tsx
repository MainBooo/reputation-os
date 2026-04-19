'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { getVkPostSearchRuns, runVkPostSearch } from '@/lib/api/vk'

type SearchProfile = {
  includeKeywords: string[]
  excludeKeywords: string[]
  contextKeywords: string[]
  geoKeywords: string[]
  category: string | null
}

type VkRun = {
  id: string
  jobStatus: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED'
  createdAt?: string
  startedAt?: string | null
  finishedAt?: string | null
  itemsDiscovered?: number | null
  itemsCreated?: number | null
  errorMessage?: string | null
  payload?: {
    mode?: string
    stage?: string
    progress?: number
    jobId?: string
  } | null
  result?: {
    stage?: string
    progress?: number
    jobId?: string
    postsFound?: number
    relevantPosts?: number
    relevantComments?: number
    errorMessage?: string
  } | null
}

function getStageLabel(stage?: string) {
  switch (stage) {
    case 'queue':
      return 'Задача поставлена в очередь'
    case 'search_posts':
      return 'Идёт поиск постов VK'
    case 'persist_mentions':
      return 'Сохраняются найденные упоминания'
    case 'completed':
      return 'Поиск завершён'
    case 'failed':
      return 'Поиск завершился ошибкой'
    default:
      return 'Подготовка запуска'
  }
}

function getProgress(run: VkRun | null) {
  if (!run) return 0
  const value = run.result?.progress ?? run.payload?.progress ?? 0
  const normalized = Number(value || 0)
  if (!Number.isFinite(normalized)) return 0
  return Math.max(0, Math.min(100, normalized))
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
  const [latestRun, setLatestRun] = useState<VkRun | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const refreshedRef = useRef(false)

  const totalKeywords = useMemo(
    () =>
      (initialProfile?.includeKeywords?.length || 0) +
      (initialProfile?.excludeKeywords?.length || 0) +
      (initialProfile?.contextKeywords?.length || 0) +
      (initialProfile?.geoKeywords?.length || 0),
    [initialProfile]
  )

  async function loadRuns(expectedJobId?: string | null) {
    const runs = await getVkPostSearchRuns(companyId)
    const normalizedRuns = Array.isArray(runs) ? (runs as VkRun[]) : []
    const matched =
      (expectedJobId
        ? normalizedRuns.find((run) => (run.result?.jobId || run.payload?.jobId) === expectedJobId)
        : null) ||
      normalizedRuns[0] ||
      null

    setLatestRun(matched)
    return matched
  }

  async function runSearch() {
    if (!sessionConnected) {
      setMessage('')
      setError('Сначала подключите VK, затем запускайте поиск')
      return
    }

    setRunning(true)
    setMessage('')
    setError('')
    refreshedRef.current = false

    try {
      const response = await runVkPostSearch(companyId)
      const nextJobId = response?.jobId ? String(response.jobId) : null

      setActiveJobId(nextJobId)
      setMessage('Поиск постов VK запущен')
      await loadRuns(nextJobId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось запустить поиск постов VK')
      setRunning(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function tick() {
      try {
        const run = await loadRuns(activeJobId)

        if (cancelled || !run) {
          return
        }

        if (run.jobStatus === 'SUCCESS') {
          setRunning(false)
          setMessage('Поиск постов VK завершён')
          if (!refreshedRef.current) {
            refreshedRef.current = true
            router.refresh()
          }
          return
        }

        if (run.jobStatus === 'FAILED' || run.jobStatus === 'CANCELLED') {
          setRunning(false)
          setError(run.errorMessage || run.result?.errorMessage || 'Поиск постов VK завершился ошибкой')
          return
        }

        if (run.jobStatus === 'PENDING' || run.jobStatus === 'RUNNING') {
          setRunning(true)
        } else {
          setRunning(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось обновить статус VK поиска')
          setRunning(false)
        }
      }
    }

    tick()

    if (!running && !activeJobId) {
      return () => {
        cancelled = true
      }
    }

    const interval = window.setInterval(tick, 2500)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [activeJobId, companyId, router, running])

  const progress = getProgress(latestRun)
  const stage = latestRun?.result?.stage || latestRun?.payload?.stage
  const statusText = latestRun ? getStageLabel(stage) : ''
  const postsFound = latestRun?.result?.postsFound ?? latestRun?.itemsDiscovered ?? 0
  const mentionsCreated = latestRun?.result?.relevantComments ?? latestRun?.itemsCreated ?? 0

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

      {latestRun && (running || latestRun.jobStatus === 'SUCCESS' || latestRun.jobStatus === 'FAILED') ? (
        <div className="mt-4 rounded-xl border border-line bg-panel2 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-brand">
              {statusText || 'Статус запуска обновляется'}
            </div>
            <div className="text-xs text-muted">{progress}%</div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
            <div>{`Статус: ${latestRun.jobStatus}`}</div>
            <div>{`Найдено постов: ${postsFound}`}</div>
            <div>{`Сохранено комментариев/упоминаний: ${mentionsCreated}`}</div>
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}
      {message ? <div className="mt-4 text-sm text-emerald-400">{message}</div> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" disabled={running || !sessionConnected} onClick={runSearch}>
          {running ? 'Поиск выполняется...' : 'Запустить поиск постов VK'}
        </Button>
      </div>
    </Card>
  )
}
