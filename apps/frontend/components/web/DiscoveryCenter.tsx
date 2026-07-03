'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import {
  deleteCompanySourceTarget,
  startCompanyWebSync,
  updateCompanySourceTarget
} from '@/lib/api/companies'
import { getCompanyMentions } from '@/lib/api/mentions'
import { useWorkspaceAccess } from '@/lib/hooks/useWorkspaceAccess'
import WebMonitoringToggle from '@/components/web/WebMonitoringToggle'

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
  mentionsCount?: number
  lastMentionAt?: string | null
  lastMention?: {
    title?: string | null
    url?: string | null
    publishedAt?: string | null
    createdAt?: string | null
  } | null
  relevanceScore?: number
  relevanceLabel?: string
  relevanceReasons?: string[]
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
}

function getConfig(target: SourceTarget) {
  if (!target.config || typeof target.config !== 'object' || Array.isArray(target.config)) return {}
  return target.config
}

function normalizeUrl(value?: string | null) {
  if (!value) return null
  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return value.trim().replace(/\/$/, '')
  }
}

function hostOf(value?: string | null) {
  if (!value) return 'Домен не определён'
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./, '')
  } catch {
    return 'Домен не определён'
  }
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

function isWebTarget(target: SourceTarget) {
  if (target.source?.platform !== 'WEB') return false
  if (isMapOrReviewPlatformUrl(target.externalUrl)) return false
  return true
}

function isActiveTarget(target: SourceTarget) {
  return target.isActive !== false && target.syncMentionsEnabled !== false
}

function isDiscoveredTarget(target: SourceTarget) {
  const config = getConfig(target)
  if (isActiveTarget(target)) return false
  if (config.status === 'EXCLUDED' || config.excluded === true) return false
  return config.origin === 'auto' || config.origin === 'auto-bootstrap' || config.origin === 'auto-bootstrap-backfill' || !target.isActive
}

function sourceTitle(target: SourceTarget) {
  return target.displayName || hostOf(target.externalUrl) || target.externalUrl || 'WEB-источник'
}

function relevanceLabel(target: SourceTarget) {
  const score = Number(target.relevanceScore || getConfig(target).relevanceScore || 0)
  const label = String(target.relevanceLabel || getConfig(target).relevanceLabel || '')

  if (label) return label
  if (score >= 75) return 'высокая'
  if (score >= 50) return 'средняя'
  if (score > 0) return 'низкая'
  return 'средняя'
}

function relevanceClass(label: string) {
  if (label.includes('высок')) return 'border-emerald-400/25 bg-blue-500/10 text-emerald-100'
  if (label.includes('низ')) return 'border-slate-400/20 bg-white/[0.04] text-zinc-300'
  return 'border-amber-400/25 bg-amber-500/10 text-amber-100'
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

function faviconUrl(host: string) {
  if (!host || host === 'Домен не определён') return null
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
}

function SourceIcon({ host }: { host: string }) {
  const url = faviconUrl(host)
  const fallback = host.replace(/\.(ru|com|net|org|ph)$/i, '').slice(0, 2).toUpperCase()

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-xs font-black text-blue-100 shadow-[0_0_22px_rgba(59,130,246,0.14)]">
      {url ? <img src={url} alt="" className="h-6 w-6 rounded-md" /> : fallback}
    </div>
  )
}

export default function DiscoveryCenter({
  companyId,
  workspaceId,
  initialTargets,
  initialOverview
}: {
  companyId: string
  workspaceId?: string | null
  initialTargets: SourceTarget[]
  initialOverview?: any
}) {
  const router = useRouter()
  const { canWrite } = useWorkspaceAccess(workspaceId)
  const [targets, setTargets] = useState<SourceTarget[]>(
    Array.isArray(initialTargets) ? initialTargets : []
  )
  const serverActiveGroups = Array.isArray(initialOverview?.activeGroups) ? initialOverview.activeGroups : []
  const serverDiscovered = Array.isArray(initialOverview?.discovered) ? initialOverview.discovered : []
  const serverSignals = Array.isArray(initialOverview?.latestSignals) ? initialOverview.latestSignals : []
  const [syncing, setSyncing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAllActive, setShowAllActive] = useState(false)
  const [showAllDiscovered, setShowAllDiscovered] = useState(false)
  const [intervalMinutes, setIntervalMinutes] = useState(1440)
  const [message, setMessage] = useState<string | null>(null)
  const [signals, setSignals] = useState<any[]>(serverSignals)

  const webTargets = useMemo(() => targets.filter(isWebTarget), [targets])

  const rootWebTargets = useMemo(
    () => targets.filter((t) => {
      if (t.source?.platform !== 'WEB') return false
      if (t.externalUrl) return false
      const cfg = t.config && typeof t.config === 'object' && !Array.isArray(t.config) ? t.config as Record<string, unknown> : {}
      return !cfg.origin
    }),
    [targets]
  )

  useEffect(() => {
    let mounted = true

    getCompanyMentions(companyId, '?page=1&limit=3&platform=WEB')
      .then((response) => {
        if (!mounted) return
        setSignals(Array.isArray(response?.data) ? response.data : [])
      })
      .catch(() => {
        if (mounted) setSignals([])
      })

    return () => {
      mounted = false
    }
  }, [companyId])
  const activeTargets = useMemo(() => webTargets.filter((target) => isActiveTarget(target) && Boolean(target.externalUrl)), [webTargets])
  const discoveredTargets = useMemo(() => webTargets.filter(isDiscoveredTarget), [webTargets])

  const groupedDiscovered = useMemo(() => {
    const map = new Map<string, SourceTarget[]>()
    for (const target of discoveredTargets) {
      const host = hostOf(target.externalUrl)
      const items = map.get(host) || []
      items.push(target)
      map.set(host, items)
    }
    return Array.from(map.entries()).map(([host, items]) => ({
      ...items[0],
      host,
      items,
      pagesCount: items.length,
      bestUrl: items[0]?.externalUrl || null,
      bestTitle: items[0]?.displayName || items[0]?.externalUrl || host
    }))
  }, [discoveredTargets])

  const groupedActive = useMemo(() => {
    const map = new Map<string, SourceTarget[]>()

    for (const target of activeTargets) {
      const host = hostOf(target.externalUrl)
      const items = map.get(host) || []
      items.push(target)
      map.set(host, items)
    }

    return Array.from(map.entries()).map(([host, items]) => ({
      host,
      items,
      mentionsCount: items.reduce((sum, item) => sum + Number(item.mentionsCount || 0), 0),
      pagesCount: items.length,
      lastMentionAt: items
        .map((item) => item.lastMentionAt || item.lastMention?.publishedAt || item.lastMention?.createdAt || null)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null
    }))
  }, [activeTargets])

  const effectiveGroupedActive = serverActiveGroups.length ? serverActiveGroups : groupedActive
  const effectiveDiscovered = serverDiscovered.length ? serverDiscovered : groupedDiscovered

  const visibleActive = showAllActive ? effectiveGroupedActive : effectiveGroupedActive.slice(0, 5)
  const visibleDiscovered = showAllDiscovered ? effectiveDiscovered : effectiveDiscovered.slice(0, 4)

  async function handleStartSync() {
    setSyncing(true)
    setMessage(null)

    try {
      await startCompanyWebSync(companyId)
      setMessage('Сканирование запущено. Найденные площадки появятся после завершения сбора.')
      router.refresh()
    } catch {
      setMessage('Не удалось запустить сканирование.')
    } finally {
      setSyncing(false)
    }
  }

  async function patchTarget(target: SourceTarget, patch: Partial<SourceTarget>) {
    setBusyId(target.id)
    setMessage(null)

    try {
      const updated: any = await updateCompanySourceTarget(companyId, target.id, {
        isActive: patch.isActive,
        syncMentionsEnabled: patch.syncMentionsEnabled,
        syncReviewsEnabled: false,
        syncRatingsEnabled: false,
        config: {
          ...(target.config || {}),
          ...(patch.config || {}),
          scanIntervalMinutes: intervalMinutes,
          scanIntervalHours: Math.round(intervalMinutes / 60)
        }
      })

      setTargets((items) =>
        items.map((item) =>
          item.id === target.id
            ? {
                ...item,
                ...updated,
                isActive: patch.isActive ?? updated?.isActive ?? item.isActive,
                syncMentionsEnabled: patch.syncMentionsEnabled ?? updated?.syncMentionsEnabled ?? item.syncMentionsEnabled
              }
            : item
        )
      )
      router.refresh()
    } catch {
      setMessage('Не удалось обновить источник.')
    } finally {
      setBusyId(null)
    }
  }

  async function patchGroup(target: SourceTarget, patch: Partial<SourceTarget>) {
    const items: SourceTarget[] = (target as any).items?.length > 1 ? (target as any).items : [target]
    setBusyId(target.id)
    setMessage(null)
    try {
      await Promise.all(items.map((item) =>
        updateCompanySourceTarget(companyId, item.id, {
          isActive: patch.isActive,
          syncMentionsEnabled: patch.syncMentionsEnabled,
          syncReviewsEnabled: false,
          syncRatingsEnabled: false,
          config: {
            ...(item.config || {}),
            ...(patch.config || {}),
            scanIntervalMinutes: intervalMinutes,
            scanIntervalHours: Math.round(intervalMinutes / 60)
          }
        })
      ))
      setTargets((prev) => prev.map((item) =>
        items.some((g) => g.id === item.id)
          ? { ...item, isActive: patch.isActive ?? item.isActive, syncMentionsEnabled: patch.syncMentionsEnabled ?? item.syncMentionsEnabled }
          : item
      ))
      router.refresh()
    } catch {
      setMessage('Не удалось обновить источник.')
    } finally {
      setBusyId(null)
    }
  }

  async function removeTarget(target: SourceTarget) {
    if (!confirm('Удалить источник из мониторинга?')) return

    setBusyId(target.id)
    setMessage(null)

    try {
      await deleteCompanySourceTarget(companyId, target.id)
      setTargets((items) => items.filter((item) => item.id !== target.id))
      router.refresh()
    } catch {
      setMessage('Не удалось удалить источник.')
    } finally {
      setBusyId(null)
    }
  }

  async function applyInterval() {
    const primaryTarget = targets[0]
    if (!primaryTarget || !canWrite || busyId === 'interval') return

    setBusyId('interval')
    setMessage('')

    try {
      await patchTarget(primaryTarget, {
        config: {
          ...(primaryTarget.config || {}),
          scanIntervalMinutes: intervalMinutes
        }
      })
      setMessage('Интервал обновлён.')
    } catch {
      setMessage('Не удалось обновить интервал.')
    } finally {
      setBusyId(null)
    }
  }

  const lastScanLabel = 'после последнего запуска'
  const currentInterval = SCAN_INTERVALS.find((item) => item.minutes === intervalMinutes) || SCAN_INTERVALS[2]

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-cyan-400/15 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.13),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(168,85,247,0.12),transparent_28%),rgba(15,23,42,0.72)] p-5 shadow-[0_0_42px_rgba(59,130,246,0.12)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xl font-semibold text-white">WEB-мониторинг</div>
              {rootWebTargets.length > 0 && canWrite ? (
                <WebMonitoringToggle
                  companyId={companyId}
                  rootTargets={rootWebTargets}
                />
              ) : null}
            </div>
            <div className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              Система ищет внешние площадки, каталоги, статьи и страницы. Яндекс Карты и 2GIS остаются отдельными источниками отзывов.
            </div>
          </div>

          
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
            <div className="text-xs text-zinc-300">Интервал</div>
              <div className="mt-2 flex gap-2">
                <select
                  value={intervalMinutes}
                  onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                  disabled={!canWrite || busyId === 'interval'}
                  className="h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {SCAN_INTERVALS.map((item) => (
                    <option key={item.minutes} value={item.minutes}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyInterval}
                  disabled={!canWrite || busyId === 'interval'}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-3 text-[11px] font-bold text-blue-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-xs"
                >
                  {busyId === 'interval' ? '…' : 'ОК'}
                </button>
              </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
            <div className="text-xs text-zinc-300">Источников</div>
            <div className="mt-2 text-3xl font-semibold text-blue-100">{activeTargets.length}</div>
            <div className="mt-1 text-xs text-emerald-200">мониторится</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
            <div className="text-xs text-zinc-300">Найдено для проверки</div>
            <div className="mt-2 text-3xl font-semibold text-white">{effectiveDiscovered.length}</div>
            <div className="mt-1 text-xs text-zinc-300">{lastScanLabel}</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
            <div className="text-xs text-zinc-300">Статус</div>
            <div className="mt-2 inline-flex rounded-full border border-emerald-400/25 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-emerald-100">
              Активно
            </div>
            <div className="mt-2 text-xs text-zinc-300">Интервал: {currentInterval.label}</div>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-violet-400/40 bg-blue-500/10 p-3 text-sm text-blue-100">
            {message}
          </div>
        ) : null}
      </Card>

      <Card className="border-white/10 bg-white/[0.025] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-white">Активные источники мониторинга</div>
            <div className="mt-1 text-sm text-zinc-300">Площадки, которые регулярно проверяются системой.</div>
          </div>

          <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-zinc-300 sm:block">
            {effectiveGroupedActive.length} активных
          </div>
        </div>

        {visibleActive.length ? (
          <div className="space-y-3">
            {visibleActive.map((group: any) => {
              const first = group.items[0]
              const busy = group.items.some((item: any) => item.id === busyId)

              return (
                <div
                  key={group.host}
                  className="rounded-[26px] border border-cyan-300/15 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.11),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_28px_rgba(34,211,238,0.05)] transition duration-300 hover:-translate-y-0.5 hover:border-blue-300/30 hover:shadow-[0_0_34px_rgba(59,130,246,0.14)]"
                >
                  <div className="flex items-start gap-4">
                    <SourceIcon host={group.host} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-semibold text-white">{group.host}</div>
                        <span className="rounded-full border border-emerald-400/25 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-100">
                          Мониторится
                        </span>
                      </div>

                      <div className="mt-1 text-sm text-zinc-300">
                        {group.pagesCount} страниц · {group.mentionsCount} упоминаний · последняя активность: {formatDate(group.lastMentionAt)}
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_112px_112px]">
                        {first.externalUrl ? (
                          <a
                            href={normalizeUrl(first.externalUrl) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-violet-400/40 bg-cyan-400/10 px-3 text-sm font-semibold text-blue-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:shadow-[0_0_18px_rgba(34,211,238,0.12)]"
                          >
                            Открыть источник ↗
                          </a>
                        ) : null}

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => patchTarget(first, { isActive: false, syncMentionsEnabled: false })}
                          className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-60"
                        >
                          Отключить
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeTarget(first)}
                          className="inline-flex h-10 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 px-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/15 disabled:opacity-60"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {effectiveGroupedActive.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllActive((value) => !value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm font-semibold text-blue-100 transition hover:bg-cyan-400/10"
              >
                {showAllActive ? 'Свернуть' : `Показать все источники (${effectiveGroupedActive.length})`}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
            <div className="text-base font-semibold text-white">Пока нет активных WEB-источников</div>
            <div className="mt-2 text-sm text-zinc-300">{canWrite ? 'Запустите сканирование и добавьте найденные площадки в мониторинг.' : 'Источники появятся после настройки администратором workspace.'}</div>
            {canWrite ? (
              <button
                type="button"
                onClick={handleStartSync}
                disabled={syncing}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-300/35 bg-cyan-300/90 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 hover:shadow-[0_0_22px_rgba(103,232,249,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncing ? <Spinner /> : 'Запустить сканирование'}
              </button>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="border-purple-400/15 bg-[radial-gradient(circle_at_0%_0%,rgba(168,85,247,0.16),transparent_32%),rgba(15,23,42,0.66)] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-white">Новые найденные площадки</div>
            <div className="mt-1 text-sm text-zinc-300">{canWrite ? 'Проверьте кандидатов и добавьте нужные в регулярный мониторинг.' : 'Найденные площадки доступны только для просмотра.'}</div>
          </div>

          <div className="hidden text-sm text-zinc-300 sm:block">{effectiveDiscovered.length} на проверке</div>
        </div>

        {visibleDiscovered.length ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {visibleDiscovered.map((target: SourceTarget) => {
                const host = hostOf(target.externalUrl)
                const label = relevanceLabel(target)
                const busy = busyId === target.id

                return (
                  <div
                    key={target.id}
                    className="flex min-h-[232px] flex-col rounded-[26px] border border-purple-300/20 bg-[linear-gradient(145deg,rgba(168,85,247,0.13),rgba(15,23,42,0.66))] p-3.5 shadow-[0_0_30px_rgba(168,85,247,0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-purple-300/35 hover:shadow-[0_0_36px_rgba(168,85,247,0.13)]"
                  >
                    <SourceIcon host={host} />

                    <div className="mt-3 line-clamp-2 min-h-[44px] text-[15px] font-semibold leading-[22px] text-white">
                      {sourceTitle(target)}
                    </div>

                    <div className="mt-1 text-sm text-zinc-300 truncate">{(target as any).bestUrl || target.externalUrl || host}</div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <div className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${relevanceClass(label)}`}>
                        {label} релевантность
                      </div>
                      {(target as any).pagesCount > 1 ? (
                        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300">
                          {(target as any).pagesCount} страниц
                        </div>
                      ) : null}
                    </div>
                      <div className={canWrite ? "mt-auto grid grid-cols-3 gap-2 pt-4" : "mt-auto grid grid-cols-1 gap-2 pt-4"}>
                        {target.externalUrl ? (
                          <a
                            href={normalizeUrl(target.externalUrl) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-violet-400/40 bg-cyan-400/10 px-3 text-sm font-semibold text-blue-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:shadow-[0_0_18px_rgba(34,211,238,0.12)]"
                          >
                            Открыть ↗
                          </a>
                        ) : (
                          <span className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-3 text-sm font-semibold text-zinc-300">
                            Нет URL
                          </span>
                        )}

                        {canWrite ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => patchGroup(target, { isActive: true, syncMentionsEnabled: true })}
                              className="inline-flex h-10 items-center justify-center rounded-2xl border border-cyan-300/35 bg-cyan-300/90 px-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 hover:shadow-[0_0_22px_rgba(103,232,249,0.24)] disabled:opacity-60"
                            >
                              {busy ? <Spinner /> : 'Добавить'}
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                patchGroup(target, {
                                  isActive: false,
                                  syncMentionsEnabled: false,
                                  config: {
                                    ...(target.config || {}),
                                    status: 'EXCLUDED',
                                    excluded: true
                                  }
                                })
                              }
                              className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] px-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-60"
                            >
                              Скрыть
                            </button>
                          </>
                        ) : null}
                      </div>

                  </div>
                )
              })}
            </div>

            {effectiveDiscovered.length > 4 ? (
              <button
                type="button"
                onClick={() => setShowAllDiscovered((value) => !value)}
                className="mt-4 w-full rounded-2xl border border-purple-300/20 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/15"
              >
                {showAllDiscovered ? 'Свернуть' : `Показать все найденные (${effectiveDiscovered.length})`}
              </button>
            ) : null}
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
            <div className="text-base font-semibold text-white">Нет новых площадок</div>
            <div className="mt-2 text-sm text-zinc-300">После следующего сканирования здесь появятся кандидаты для подключения.</div>
          </div>
        )}
      </Card>

      <Card className="border-cyan-400/10 bg-[radial-gradient(circle_at_100%_0%,rgba(34,211,238,0.12),transparent_32%),rgba(15,23,42,0.62)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-white">Последние WEB-сигналы</div>
            <div className="mt-1 text-sm text-zinc-300">Короткая сводка последних упоминаний. Полная лента остаётся в Inbox.</div>
          </div>

          <a
            href={`/companies/${companyId}/inbox?platform=WEB`}
            className="hidden rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-cyan-400/20 sm:inline-flex"
          >
            Открыть Inbox →
          </a>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {signals.length ? (
            signals.map((signal) => {
              const host = hostOf(signal.url || signal.sourceUrl)
              const title = signal.title || signal.content || signal.url || 'WEB-сигнал'

              return (
                <div key={signal.id} className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-3">
                    <SourceIcon host={host} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{host}</div>
                      <div className="text-xs text-zinc-300">{formatDate(signal.publishedAt || signal.createdAt)}</div>
                    </div>
                  </div>

                  <div className="mt-3 line-clamp-2 text-sm leading-6 text-brand">{title}</div>
                </div>
              )
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-zinc-300 md:col-span-3">
              Пока нет последних WEB-сигналов. После сканирования они появятся в Inbox.
            </div>
          )}
        </div>

        <a
          href={`/companies/${companyId}/inbox?platform=WEB`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:bg-cyan-400/20 sm:hidden"
        >
          Открыть WEB в Inbox →
        </a>
      </Card>

      <Card className="border-cyan-400/10 bg-white/[0.025] p-5">
        <div className="text-lg font-semibold text-white">Как работает мониторинг?</div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-sm font-semibold text-blue-100">1. Находим страницы</div>
            <div className="mt-2 text-sm leading-6 text-zinc-300">Система ищет упоминания компании во внешней сети и каталогах.</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-sm font-semibold text-blue-100">2. Вы выбираете источники</div>
            <div className="mt-2 text-sm leading-6 text-zinc-300">В мониторинг добавляются только площадки, которые важны для бизнеса.</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-sm font-semibold text-blue-100">3. Получаете сигналы в Inbox</div>
            <div className="mt-2 text-sm leading-6 text-zinc-300">Все новые упоминания и отзывы попадают в единый Inbox.</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
