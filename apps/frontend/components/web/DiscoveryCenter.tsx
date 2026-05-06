'use client'

import { useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import {
  deleteCompanySourceTarget,
  getCompanySourceTargets,
  startCompanySync,
  updateCompanySourceTarget
} from '@/lib/api/companies'

const SCAN_INTERVALS = [
  { label: '4 часа', hours: 4, minutes: 240 },
  { label: '12 часов', hours: 12, minutes: 720 },
  { label: '24 часа', hours: 24, minutes: 1440 }
]

type SourceTarget = {
  id: string
  externalUrl?: string | null
  displayName?: string | null
  isActive?: boolean
  syncMentionsEnabled?: boolean
  syncReviewsEnabled?: boolean
  syncRatingsEnabled?: boolean
  config?: Record<string, unknown> | null
  source?: {
    platform?: string
    type?: string
    name?: string
  }
  status?: 'MONITORED' | 'DISCOVERED' | 'NEEDS_REVIEW' | 'EXCLUDED' | 'ERROR' | string
  sourceKind?: string
  mentionsCount?: number
  lastMentionAt?: string | null
  lastMention?: {
    id?: string
    title?: string | null
    url?: string | null
    publishedAt?: string | null
    createdAt?: string | null
  } | null
  relevanceScore?: number
  relevanceLabel?: string
  relevanceReasons?: string[]
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={[
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        dark ? 'text-slate-950' : 'text-cyan-200'
      ].join(' ')}
    />
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getConfig(target: SourceTarget) {
  if (!target.config || typeof target.config !== 'object' || Array.isArray(target.config)) return {}
  return target.config
}

function isMapOrReviewPlatformUrl(value?: string | null) {
  if (!value) return false

  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const path = parsed.pathname.toLowerCase()

    return (
      host === '2gis.ru' ||
      host.endsWith('.2gis.ru') ||
      ((host === 'yandex.ru' || host.endsWith('.yandex.ru') || host === 'yandex.com' || host.endsWith('.yandex.com')) &&
        path.startsWith('/maps'))
    )
  } catch {
    const normalized = value.toLowerCase()
    return normalized.includes('2gis.ru') || normalized.includes('yandex.ru/maps') || normalized.includes('yandex.com/maps')
  }
}

function sourceHost(value?: string | null) {
  if (!value) return null

  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function normalizeUrl(value?: string | null) {
  if (!value) return null
  return value.startsWith('http') ? value : `https://${value}`
}

function formatDate(value?: string | null) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStatus(target: SourceTarget) {
  const config = getConfig(target)

  if (target.status) return target.status
  if (config.lastError) return 'ERROR'
  if (config.status === 'EXCLUDED' || config.excluded === true) return 'EXCLUDED'
  if (target.isActive && target.syncMentionsEnabled) return 'MONITORED'
  if (config.status === 'NEEDS_REVIEW') return 'NEEDS_REVIEW'
  if (config.origin === 'auto' && !target.isActive) return 'DISCOVERED'

  return target.isActive ? 'MONITORED' : 'NEEDS_REVIEW'
}

function statusLabel(status: string) {
  if (status === 'MONITORED') return 'Мониторится'
  if (status === 'DISCOVERED') return 'Найден'
  if (status === 'NEEDS_REVIEW') return 'Нужно проверить'
  if (status === 'EXCLUDED') return 'Исключён'
  if (status === 'ERROR') return 'Ошибка'
  return status
}

function statusClass(status: string) {
  if (status === 'MONITORED') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
  if (status === 'DISCOVERED') return 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100'
  if (status === 'NEEDS_REVIEW') return 'border-amber-400/25 bg-amber-500/10 text-amber-100'
  if (status === 'ERROR') return 'border-red-400/25 bg-red-500/10 text-red-100'
  return 'border-white/10 bg-white/[0.04] text-muted'
}

function sourceTitle(target: SourceTarget) {
  return target.displayName || sourceHost(target.externalUrl) || target.externalUrl || 'Источник'
}

function relevanceText(target: SourceTarget) {
  const score = Number(target.relevanceScore || 0)

  if (target.relevanceLabel) return target.relevanceLabel
  if (score >= 75) return 'высокая'
  if (score >= 50) return 'средняя'
  return 'низкая'
}

function getRelevanceReasons(target: SourceTarget) {
  const config = getConfig(target)

  if (Array.isArray(target.relevanceReasons) && target.relevanceReasons.length > 0) return target.relevanceReasons
  if (Array.isArray(config.relevanceReasons)) return config.relevanceReasons.filter((item) => typeof item === 'string') as string[]

  return []
}

function getIntervalHours(target: SourceTarget, fallbackHours: number) {
  const config = getConfig(target)
  const minutes = Number(config.scanIntervalMinutes || config.autoScanEveryMinutes || config.everyMinutes)

  if (minutes === 240) return 4
  if (minutes === 720) return 12
  if (minutes === 1440) return 24

  return fallbackHours
}

function LastMentionBlock({ target }: { target: SourceTarget }) {
  const title = target.lastMention?.title || target.lastMention?.url || null
  const url = target.lastMention?.url || target.externalUrl || null
  const href = normalizeUrl(url)
  const date = target.lastMentionAt || target.lastMention?.publishedAt || target.lastMention?.createdAt || null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">
        Последнее упоминание
      </div>

      {title ? (
        <div className="mt-2 space-y-1">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-2 text-sm font-medium leading-5 text-cyan-100 hover:text-cyan-50"
            >
              {title}
            </a>
          ) : (
            <div className="line-clamp-2 text-sm font-medium leading-5 text-brand">{title}</div>
          )}

          <div className="text-xs text-muted">
            {date ? `Найдено: ${formatDate(date)}` : 'Дата не определена'}
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm leading-5 text-muted">
          Пока нет найденных упоминаний. Ссылка появится после первого успешного сбора.
        </div>
      )}
    </div>
  )
}

function SourceActions({
  isBusy,
  onDelete,
  onDisable
}: {
  isBusy: boolean
  onDelete: () => void
  onDisable?: () => void
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {onDisable ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={onDisable}
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-2.5 py-2.5 text-xs font-semibold text-muted transition hover:border-amber-400/30 hover:bg-amber-500/10 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? 'Сохраняем…' : 'Отключить'}
        </button>
      ) : null}

      <button
        type="button"
        disabled={isBusy}
        onClick={onDelete}
        className="rounded-2xl border border-red-400/20 bg-red-500/10 px-2.5 py-2.5 text-xs font-semibold text-red-100 transition hover:border-red-300/40 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? 'Удаляем…' : 'Удалить'}
      </button>
    </div>
  )
}

function MonitoredSourceCard({
  target,
  busyId,
  onDisable,
  onDelete
}: {
  target: SourceTarget
  busyId: string | null
  onDisable: (target: SourceTarget) => Promise<void>
  onDelete: (target: SourceTarget) => Promise<void>
}) {
  const status = getStatus(target)
  const host = sourceHost(target.externalUrl)
  const href = normalizeUrl(target.externalUrl)
  const isBusy = busyId === target.id

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/15 hover:bg-white/[0.04]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="truncate text-base font-semibold text-brand hover:text-cyan-100"
            >
              {sourceTitle(target)}
            </a>
          ) : (
            <div className="truncate text-base font-semibold text-brand">{sourceTitle(target)}</div>
          )}

          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>
            {statusLabel(status)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          {host ? (
            <a href={href || '#'} target="_blank" rel="noreferrer" className="text-cyan-100/80 hover:text-cyan-50">
              {host}
            </a>
          ) : (
            <span>Домен не определён</span>
          )}

          {typeof target.mentionsCount === 'number' ? (
            <span className="text-muted">· {target.mentionsCount} упоминаний</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <LastMentionBlock target={target} />
      </div>

      <SourceActions
        isBusy={isBusy}
        onDisable={() => onDisable(target)}
        onDelete={() => onDelete(target)}
      />
    </div>
  )
}

function CandidateSourceCard({
  target,
  busyId,
  onApprove,
  onExclude,
  onDelete
}: {
  target: SourceTarget
  busyId: string | null
  onApprove: (target: SourceTarget) => Promise<void>
  onExclude: (target: SourceTarget) => Promise<void>
  onDelete: (target: SourceTarget) => Promise<void>
}) {
  const status = getStatus(target)
  const host = sourceHost(target.externalUrl)
  const href = normalizeUrl(target.externalUrl)
  const reasons = getRelevanceReasons(target)
  const isBusy = busyId === target.id

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/15 hover:bg-white/[0.04]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="truncate text-base font-semibold text-brand hover:text-cyan-100"
            >
              {sourceTitle(target)}
            </a>
          ) : (
            <div className="truncate text-base font-semibold text-brand">{sourceTitle(target)}</div>
          )}

          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>
            {statusLabel(status)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          {host ? (
            <a href={href || '#'} target="_blank" rel="noreferrer" className="text-cyan-100/80 hover:text-cyan-50">
              {host}
            </a>
          ) : (
            <span>Домен не определён</span>
          )}

          <span>· релевантность: {relevanceText(target)}</span>
        </div>

        {reasons.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {reasons.slice(0, 3).map((reason) => (
              <span
                key={reason}
                className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-muted"
              >
                {reason}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onApprove(target)}
          className="rounded-2xl bg-cyan-300 px-2.5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner dark />
              Включаем…
            </span>
          ) : (
            'Включить'
          )}
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => onExclude(target)}
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-2.5 py-2.5 text-xs font-semibold text-muted transition hover:border-white/20 hover:bg-white/[0.05] hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? 'Сохраняем…' : 'Скрыть'}
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => onDelete(target)}
          className="rounded-2xl border border-red-400/20 bg-red-500/10 px-2.5 py-2.5 text-xs font-semibold text-red-100 transition hover:border-red-300/40 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? 'Удаляем…' : 'Удалить'}
        </button>
      </div>
    </div>
  )
}

export default function DiscoveryCenter({
  companyId,
  initialTargets
}: {
  companyId: string
  initialTargets: SourceTarget[]
}) {
  const [targets, setTargets] = useState<SourceTarget[]>(initialTargets || [])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanState, setScanState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [scanMessage, setScanMessage] = useState('Сканирование не запущено')
  const [isSavingInterval, setIsSavingInterval] = useState(false)

  const webTargets = useMemo(() => {
    return targets.filter((target) => {
      if (target.source?.platform !== 'WEB') return false
      if (isMapOrReviewPlatformUrl(target.externalUrl)) return false
      return true
    })
  }, [targets])

  const visibleTargets = useMemo(() => {
    return webTargets.filter((target) => getStatus(target) !== 'EXCLUDED')
  }, [webTargets])

  const monitoredTargets = useMemo(() => {
    return visibleTargets.filter((target) => getStatus(target) === 'MONITORED')
  }, [visibleTargets])

  const candidateTargets = useMemo(() => {
    return visibleTargets.filter((target) => {
      const status = getStatus(target)
      return status === 'DISCOVERED' || status === 'NEEDS_REVIEW' || status === 'ERROR'
    })
  }, [visibleTargets])

  const hiddenWeakCount = 0

  const defaultIntervalHours = useMemo(() => {
    const firstConfigured = monitoredTargets.find((target) => {
      const config = getConfig(target)
      return config.scanIntervalMinutes || config.autoScanEveryMinutes || config.everyMinutes
    })

    return firstConfigured ? getIntervalHours(firstConfigured, 24) : 24
  }, [monitoredTargets])

  const [scanIntervalHours, setScanIntervalHours] = useState(defaultIntervalHours)

  async function reloadTargets() {
    const freshTargets = await getCompanySourceTargets(companyId)
    setTargets(Array.isArray(freshTargets) ? freshTargets : [])
  }

  async function runScan() {
    if (isScanning) return

    setIsScanning(true)
    setScanState('running')
    setScanMessage('Сканирование запущено. Можно не нажимать повторно — система ищет новые источники и обновляет список.')

    try {
      await startCompanySync(companyId)

      for (let step = 0; step < 6; step += 1) {
        await sleep(3000)
        await reloadTargets()
        setScanMessage(
          step < 5
            ? `Сканирование идёт… обновляем найденные источники (${step + 1}/6)`
            : 'Финально обновляем список найденных источников…'
        )
      }

      await reloadTargets()
      setScanState('done')
      setScanMessage('Сканирование завершено. Проверьте блок «Найденные источники».')
    } catch {
      setScanState('error')
      setScanMessage('Не удалось запустить сканирование. Проверьте API/worker и попробуйте ещё раз.')
    } finally {
      setIsScanning(false)
    }
  }

  async function saveGlobalInterval(hours: number) {
    setScanIntervalHours(hours)
    setIsSavingInterval(true)

    const interval = SCAN_INTERVALS.find((item) => item.hours === hours) || SCAN_INTERVALS[2]
    const activeTargets = monitoredTargets

    try {
      await Promise.all(
        activeTargets.map((target) => {
          const config = getConfig(target)

          return updateCompanySourceTarget(companyId, target.id, {
            config: {
              ...config,
              scanIntervalHours: interval.hours,
              scanIntervalMinutes: interval.minutes,
              autoScanEveryMinutes: interval.minutes
            }
          })
        })
      )

      await reloadTargets()
    } finally {
      setIsSavingInterval(false)
    }
  }

  async function approve(target: SourceTarget) {
    setBusyId(target.id)

    const interval = SCAN_INTERVALS.find((item) => item.hours === scanIntervalHours) || SCAN_INTERVALS[2]
    const config = getConfig(target)

    try {
      setTargets((current) =>
        current.map((item) =>
          item.id === target.id
            ? {
                ...item,
                isActive: true,
                syncMentionsEnabled: true,
                syncReviewsEnabled: false,
                syncRatingsEnabled: false,
                status: 'MONITORED',
                config: {
                  ...config,
                  origin: 'approved',
                  status: 'MONITORED',
                  approvedAt: new Date().toISOString(),
                  excluded: false,
                  scanIntervalHours: interval.hours,
                  scanIntervalMinutes: interval.minutes,
                  autoScanEveryMinutes: interval.minutes
                }
              }
            : item
        )
      )

      await updateCompanySourceTarget(companyId, target.id, {
        isActive: true,
        syncMentionsEnabled: true,
        syncReviewsEnabled: false,
        syncRatingsEnabled: false,
        config: {
          ...config,
          origin: 'approved',
          status: 'MONITORED',
          approvedAt: new Date().toISOString(),
          excluded: false,
          scanIntervalHours: interval.hours,
          scanIntervalMinutes: interval.minutes,
          autoScanEveryMinutes: interval.minutes
        }
      })

      await reloadTargets()
    } finally {
      setBusyId(null)
    }
  }

  async function disable(target: SourceTarget) {
    setBusyId(target.id)

    const config = getConfig(target)

    try {
      setTargets((current) =>
        current.map((item) =>
          item.id === target.id
            ? {
                ...item,
                isActive: false,
                syncMentionsEnabled: false,
                status: 'NEEDS_REVIEW',
                config: {
                  ...config,
                  status: 'NEEDS_REVIEW',
                  disabledAt: new Date().toISOString()
                }
              }
            : item
        )
      )

      await updateCompanySourceTarget(companyId, target.id, {
        isActive: false,
        syncMentionsEnabled: false,
        syncReviewsEnabled: false,
        syncRatingsEnabled: false,
        config: {
          ...config,
          status: 'NEEDS_REVIEW',
          disabledAt: new Date().toISOString()
        }
      })

      await reloadTargets()
    } finally {
      setBusyId(null)
    }
  }

  async function exclude(target: SourceTarget) {
    setBusyId(target.id)

    const config = getConfig(target)

    try {
      setTargets((current) => current.filter((item) => item.id !== target.id))

      await updateCompanySourceTarget(companyId, target.id, {
        isActive: false,
        syncMentionsEnabled: false,
        syncReviewsEnabled: false,
        syncRatingsEnabled: false,
        config: {
          ...config,
          status: 'EXCLUDED',
          excluded: true,
          excludedAt: new Date().toISOString()
        }
      })

      await reloadTargets()
    } finally {
      setBusyId(null)
    }
  }

  async function deleteTarget(target: SourceTarget) {
    setBusyId(target.id)

    try {
      setTargets((current) => current.filter((item) => item.id !== target.id))
      await deleteCompanySourceTarget(companyId, target.id)
      await reloadTargets()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 bg-white/[0.025] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-xl font-semibold text-brand">Мониторинг сети</div>
              <div className="mt-2 text-sm leading-6 text-muted">
                Система ищет внешние источники: сайты, статьи, каталоги, RSS и найденные страницы.
                Яндекс Карты и 2GIS остаются отдельными источниками отзывов.
              </div>

              {hiddenWeakCount > 0 ? (
                <div className="mt-3 text-xs text-muted">Низкая релевантность помечается внутри карточек, но источники больше не скрываются</div>
              ) : null}
            </div>

            <div className="grid w-full gap-3 lg:w-[360px]">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Интервал автосканирования
                </label>

                <select
                  value={scanIntervalHours}
                  disabled={isSavingInterval || monitoredTargets.length === 0}
                  onChange={(event) => saveGlobalInterval(Number(event.target.value))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-brand outline-none transition hover:border-white/20 focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {SCAN_INTERVALS.map((item) => (
                    <option key={item.hours} value={item.hours}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <div className="mt-2 text-xs leading-5 text-muted">
                  Применяется ко всем web-источникам на мониторинге.
                </div>
              </div>

              <button
                type="button"
                disabled={isScanning}
                onClick={runScan}
                className="rounded-2xl bg-cyan-300 px-2.5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isScanning ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Spinner dark />
                    Сканируем…
                  </span>
                ) : (
                  'Запустить сканирование'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div
            className={[
              'rounded-3xl border p-4',
              scanState === 'running'
                ? 'border-cyan-300/30 bg-cyan-300/10'
                : scanState === 'done'
                  ? 'border-emerald-300/25 bg-emerald-500/10'
                  : scanState === 'error'
                    ? 'border-red-300/25 bg-red-500/10'
                    : 'border-white/10 bg-white/[0.025]'
            ].join(' ')}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                {scanState === 'running' ? <Spinner /> : scanState === 'done' ? '✓' : scanState === 'error' ? '!' : '•'}
              </div>

              <div>
                <div className="font-semibold text-brand">
                  {scanState === 'running'
                    ? 'Сканирование выполняется'
                    : scanState === 'done'
                      ? 'Сканирование завершено'
                      : scanState === 'error'
                        ? 'Ошибка сканирования'
                        : 'Готово к сканированию'}
                </div>
                <div className="mt-1 text-sm leading-6 text-muted">{scanMessage}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-2xl font-semibold text-brand">{monitoredTargets.length}</div>
            <div className="mt-1 text-sm text-muted">источников на мониторинге</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-2xl font-semibold text-brand">{candidateTargets.length}</div>
            <div className="mt-1 text-sm text-muted">найдено для проверки</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-2xl font-semibold text-brand">{scanIntervalHours} ч</div>
            <div className="mt-1 text-sm text-muted">текущий интервал</div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-brand">Источники на мониторинге</div>
            <div className="mt-1 text-sm leading-6 text-muted">
              Эти площадки регулярно проверяются системой.
            </div>
          </div>

          <div className="text-sm text-muted">{monitoredTargets.length} активных</div>
        </div>

        <div className="mt-5 space-y-3">
          {monitoredTargets.length > 0 ? (
            monitoredTargets.map((target) => (
              <MonitoredSourceCard
                key={target.id}
                target={target}
                busyId={busyId}
                onDisable={disable}
                onDelete={deleteTarget}
              />
            ))
          ) : (
            <EmptyState
              title="Пока нет источников на мониторинге"
              description="Запустите сканирование или включите найденный источник вручную."
            />
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-brand">Найденные источники</div>
            <div className="mt-1 text-sm leading-6 text-muted">
              Проверьте найденные страницы и добавьте нужные в регулярный мониторинг.
            </div>
          </div>

          <div className="text-sm text-muted">{candidateTargets.length} на проверке</div>
        </div>

        <div className="mt-5 space-y-3">
          {candidateTargets.length > 0 ? (
            candidateTargets.map((target) => (
              <CandidateSourceCard
                key={target.id}
                target={target}
                busyId={busyId}
                onApprove={approve}
                onExclude={exclude}
                onDelete={deleteTarget}
              />
            ))
          ) : (
            <EmptyState
              title="Нет новых источников"
              description="После следующего сканирования здесь появятся найденные площадки для проверки."
            />
          )}
        </div>
      </Card>
    </div>
  )
}
