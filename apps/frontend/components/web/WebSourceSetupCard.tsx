'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import {
  deleteCompanySourceTarget,
  getCompanySourceTargets,
  startCompanySync,
  updateCompanySourceTarget
} from '@/lib/api/companies'

type SourceTarget = {
  id: string
  externalUrl?: string | null
  displayName?: string | null
  isActive?: boolean
  syncMentionsEnabled?: boolean
  config?: {
    origin?: 'auto' | 'manual'
    scanIntervalHours?: number
    scanIntervalMinutes?: number
    relevanceScore?: number
    relevanceReasons?: string[]
  } | null
  source?: {
    platform?: string
    type?: string
    name?: string
  }
}

const INTERVALS = [
  { label: '24 часа', hours: 24, minutes: 1440 },
  { label: '12 часов', hours: 12, minutes: 720 },
  { label: '4 часа', hours: 4, minutes: 240 }
]

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

function intervalFromTarget(target?: SourceTarget | null) {
  const minutes = Number(target?.config?.scanIntervalMinutes || 0)
  if (minutes > 0) return minutes

  const hours = Number(target?.config?.scanIntervalHours || 24)
  return Math.round(hours * 60)
}

function sourceTitle(target: SourceTarget) {
  return target.displayName || sourceHost(target.externalUrl) || target.externalUrl || 'WEB-источник'
}

export default function WebSourceSetupCard({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [targets, setTargets] = useState<SourceTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showSources, setShowSources] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const webTargets = useMemo(
    () =>
      targets.filter((target) => {
        if (target.source?.platform !== 'WEB') return false
        return !isMapOrReviewPlatformUrl(target.externalUrl)
      }),
    [targets]
  )

  const enabledCount = webTargets.filter(
    (target) => target.isActive !== false && target.syncMentionsEnabled !== false
  ).length

  const primaryTarget = webTargets.find((target) => target.isActive !== false) || webTargets[0] || null
  const intervalMinutes = intervalFromTarget(primaryTarget)

  async function loadTargets() {
    setLoading(true)
    try {
      const data = await getCompanySourceTargets(companyId)
      setTargets(Array.isArray(data) ? data : [])
    } catch {
      setMessage('Не удалось загрузить WEB-настройки.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTargets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  async function handleStartSync() {
    setSyncing(true)
    setMessage(null)

    try {
      await startCompanySync(companyId)
      setMessage('Сканирование запущено. Новые WEB-упоминания появятся после обработки.')
      router.refresh()
    } catch {
      setMessage('Не удалось запустить сканирование.')
    } finally {
      setSyncing(false)
    }
  }

  async function patchTargets(targetsToPatch: SourceTarget[], patch: Partial<SourceTarget>) {
    if (!targetsToPatch.length) {
      setMessage('Сначала добавьте источник из карточки WEB-упоминания ниже.')
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      await Promise.all(
        targetsToPatch.map((target) =>
          updateCompanySourceTarget(companyId, target.id, {
            isActive: patch.isActive,
            syncMentionsEnabled: patch.syncMentionsEnabled,
            config: {
              ...(target.config || {}),
              ...(patch.config || {})
            }
          })
        )
      )

      await loadTargets()
      router.refresh()
    } catch {
      setMessage('Не удалось обновить WEB-настройки.')
    } finally {
      setSaving(false)
    }
  }

  async function removeTarget(target: SourceTarget) {
    if (!confirm('Удалить этот источник из автосканирования?')) return

    setDeletingId(target.id)
    setMessage(null)

    try {
      await deleteCompanySourceTarget(companyId, target.id)
      await loadTargets()
      setMessage('Источник удалён из автосканирования.')
      router.refresh()
    } catch {
      setMessage('Не удалось удалить источник.')
    } finally {
      setDeletingId(null)
    }
  }

  async function patchOneTarget(target: SourceTarget, patch: Partial<SourceTarget>) {
    await patchTargets([target], patch)
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-brand">Сканирование сети</div>
          <div className="mt-2 text-sm leading-6 text-muted">
            WEB-источники без Яндекс Карт и 2GIS. Добавляйте источники из найденных упоминаний ниже.
          </div>
        </div>

        <button
          type="button"
          onClick={handleStartSync}
          disabled={syncing}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? 'Запускаем…' : 'Запустить сканирование'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted">
          {loading
            ? 'Загружаем настройки…'
            : webTargets.length > 0
              ? `Источников: ${webTargets.length} · включено: ${enabledCount}`
              : 'Источники ещё не добавлены'}
        </div>

        <select
          value={intervalMinutes}
          disabled={!webTargets.length || saving}
          onChange={(event) => {
            const minutes = Number(event.target.value)
            const selected = INTERVALS.find((item) => item.minutes === minutes)

            patchTargets(webTargets, {
              config: {
                scanIntervalMinutes: minutes,
                scanIntervalHours: selected?.hours || minutes / 60
              }
            })
          }}
          className="h-10 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm text-brand outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {INTERVALS.map((item) => (
            <option key={item.minutes} value={item.minutes}>
              Каждые {item.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={!webTargets.length || saving}
          onClick={() =>
            patchTargets(webTargets, {
              isActive: true,
              syncMentionsEnabled: true
            })
          }
          className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Включить все
        </button>

        <button
          type="button"
          disabled={!webTargets.length || saving}
          onClick={() =>
            patchTargets(webTargets, {
              isActive: false,
              syncMentionsEnabled: false
            })
          }
          className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-brand transition hover:border-cyan-400/30 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Отключить все
        </button>
      </div>

      {webTargets.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowSources((value) => !value)}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-brand transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
          >
            {showSources ? 'Скрыть источники' : `Управлять источниками (${webTargets.length})`}
          </button>

          {showSources ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="px-1 pb-3 text-sm font-semibold text-brand">
                Подключенные источники автосканирования
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {webTargets.map((target) => {
                  const enabled = target.isActive !== false && target.syncMentionsEnabled !== false

                  return (
                    <div
                      key={target.id}
                      className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-brand">
                          {sourceTitle(target)}
                        </div>

                        {target.externalUrl ? (
                          <a
                            href={target.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block truncate text-xs text-cyan-200 hover:text-cyan-100"
                          >
                            {sourceHost(target.externalUrl) || target.externalUrl}
                          </a>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            patchOneTarget(target, {
                              isActive: !enabled,
                              syncMentionsEnabled: !enabled
                            })
                          }
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 px-3 text-xs font-semibold text-brand transition hover:border-cyan-400/30 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {enabled ? 'Включён' : 'Выключен'}
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === target.id}
                          onClick={() => removeTarget(target)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === target.id ? 'Удаляем…' : 'Удалить'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? <div className="mt-4 text-sm text-muted">{message}</div> : null}
    </Card>
  )
}
