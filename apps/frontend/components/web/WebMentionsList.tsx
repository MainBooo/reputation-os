'use client'

import { useEffect, useMemo, useState } from 'react'
import EmptyState from '@/components/ui/EmptyState'
import MentionRow from '@/components/mentions/MentionRow'
import { deleteMention } from '@/lib/api/mentions'
import {
  createCompanySourceTarget,
  getCompanySourceTargets,
  updateCompanySourceTarget
} from '@/lib/api/companies'

type SourceTarget = {
  id: string
  externalUrl?: string | null
  displayName?: string | null
  isActive?: boolean
  syncMentionsEnabled?: boolean
  config?: Record<string, unknown> | null
  source?: {
    platform?: string
    type?: string
    name?: string
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

function normalizeUrl(value?: string | null) {
  if (!value) return null

  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
    parsed.hash = ''

    const removableParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'yclid',
      'from',
      'lr'
    ]

    removableParams.forEach((param) => parsed.searchParams.delete(param))

    return parsed.toString().replace(/\/$/, '')
  } catch {
    return value.trim().replace(/\/$/, '')
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

export default function WebMentionsList({
  companyId,
  initialMentions
}: {
  companyId: string
  initialMentions: any[]
}) {
  const [mentions, setMentions] = useState(() => Array.isArray(initialMentions) ? initialMentions : [])
  const [targets, setTargets] = useState<SourceTarget[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addingUrl, setAddingUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadTargets() {
    try {
      const data = await getCompanySourceTargets(companyId)
      setTargets(Array.isArray(data) ? data : [])
    } catch {
      setMessage('Не удалось загрузить список источников.')
    }
  }

  useEffect(() => {
    loadTargets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const addedUrls = useMemo(() => {
    const values = new Set<string>()

    targets
      .filter((target) => target.source?.platform === 'WEB')
      .forEach((target) => {
        const normalized = normalizeUrl(target.externalUrl)
        if (normalized) values.add(normalized)
      })

    return values
  }, [targets])

  const visibleMentions = useMemo(
    () =>
      mentions.filter((mention) => {
        if (mention.platform !== 'WEB') return false
        return !isMapOrReviewPlatformUrl(mention.url || mention.sourceUrl)
      }),
    [mentions]
  )

  function isSourceAdded(url?: string | null) {
    const normalized = normalizeUrl(url)
    return normalized ? addedUrls.has(normalized) : false
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить это WEB-упоминание?')) return

    setDeletingId(id)
    setMessage(null)

    try {
      await deleteMention(id)
      setMentions((items) => items.filter((item) => item.id !== id))
    } catch {
      setMessage('Не удалось удалить упоминание.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAddSource(mention: any) {
    const externalUrl = mention.url || mention.sourceUrl

    if (!externalUrl) {
      setMessage('У этого упоминания нет ссылки на источник.')
      return
    }

    if (isMapOrReviewPlatformUrl(externalUrl)) {
      setMessage('Яндекс Карты и 2GIS отслеживаются через Inbox.')
      return
    }

    const normalized = normalizeUrl(externalUrl)
    if (!normalized) {
      setMessage('Не удалось распознать ссылку источника.')
      return
    }

    setAddingUrl(normalized)
    setMessage(null)

    try {
      const existingTarget = targets.find((target) => normalizeUrl(target.externalUrl) === normalized)

      if (existingTarget) {
        await updateCompanySourceTarget(companyId, existingTarget.id, {
          isActive: true,
          syncMentionsEnabled: true,
          syncReviewsEnabled: false,
          syncRatingsEnabled: false,
          config: {
            ...(existingTarget.config || {}),
            origin: existingTarget.config?.origin || 'manual',
            scanIntervalHours: Number(existingTarget.config?.scanIntervalHours || 24),
            scanIntervalMinutes: Number(existingTarget.config?.scanIntervalMinutes || 1440),
            addedFromMentionId: mention.id
          }
        })
      } else {
        await createCompanySourceTarget(companyId, {
          platform: 'WEB',
          externalUrl: normalized,
          displayName: mention.title || sourceHost(normalized) || normalized,
          syncReviewsEnabled: false,
          syncRatingsEnabled: false,
          syncMentionsEnabled: true,
          config: {
            origin: 'manual',
            scanIntervalHours: 24,
            scanIntervalMinutes: 1440,
            addedFromMentionId: mention.id
          }
        })
      }

      await loadTargets()
      setMessage('Источник добавлен в автосканирование.')
    } catch {
      setMessage('Не удалось добавить источник в автосканирование.')
    } finally {
      setAddingUrl(null)
    }
  }

  return (
    <div className="mt-5 space-y-3">
      {message ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted">
          {message}
        </div>
      ) : null}

      {visibleMentions.length > 0 ? (
        visibleMentions.map((mention: any) => {
          const url = mention.url || mention.sourceUrl
          const normalized = normalizeUrl(url)
          const sourceAdded = isSourceAdded(url)
          const isAdding = normalized ? addingUrl === normalized : false

          return (
            <MentionRow
              key={mention.id}
              mention={mention}
              hideMetaBadges
              actions={
                <>
                  {sourceAdded ? (
                    <span className="inline-flex items-center rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                      Источник добавлен
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddSource(mention)}
                      disabled={isAdding}
                      className="inline-flex items-center rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAdding ? 'Добавляем…' : 'Добавить в автосканирование'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(mention.id)}
                    disabled={deletingId === mention.id}
                    className="inline-flex items-center rounded-md border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === mention.id ? 'Удаляем…' : 'Удалить'}
                  </button>
                </>
              }
            />
          )
        })
      ) : (
        <EmptyState
          title="WEB-упоминаний пока нет"
          description="Запустите сканирование или дождитесь фоновой синхронизации — найденные страницы появятся здесь."
        />
      )}
    </div>
  )
}
