'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { deleteMention, getCompanyMentions } from '@/lib/api/mentions'

type WebMention = {
  id: string
  title?: string | null
  content?: string | null
  url?: string | null
  platform?: string | null
  type?: string | null
  publishedAt?: string | null
  createdAt?: string | null
}

function normalizeUrl(value?: string | null) {
  if (!value) return null
  return value.startsWith('http') ? value : `https://${value}`
}

function sourceHost(value?: string | null) {
  if (!value) return 'Источник не определён'

  try {
    return new URL(normalizeUrl(value) || value).hostname.replace(/^www\./, '')
  } catch {
    return 'Источник не определён'
  }
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

function extractItems(response: unknown): WebMention[] {
  if (Array.isArray(response)) return response as WebMention[]

  if (response && typeof response === 'object') {
    const objectResponse = response as {
      data?: unknown
      items?: unknown
      mentions?: unknown
    }

    if (Array.isArray(objectResponse.data)) return objectResponse.data as WebMention[]
    if (Array.isArray(objectResponse.items)) return objectResponse.items as WebMention[]
    if (Array.isArray(objectResponse.mentions)) return objectResponse.mentions as WebMention[]
  }

  return []
}

export default function LatestWebMentions({ companyId }: { companyId: string }) {
  const [mentions, setMentions] = useState<WebMention[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadMentions() {
    setError(null)

    try {
      const response = await getCompanyMentions(companyId, '?page=1&limit=20&platform=WEB')
      setMentions(extractItems(response))
    } catch {
      setError('Не удалось загрузить последние упоминания.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMentions()
    const timer = window.setInterval(loadMentions, 8000)

    return () => window.clearInterval(timer)
  }, [companyId])

  async function removeMention(mention: WebMention) {
    setBusyId(mention.id)

    try {
      await deleteMention(mention.id)
      setMentions((current) => current.filter((item) => item.id !== mention.id))
    } finally {
      setBusyId(null)
    }
  }

  const visibleMentions = useMemo(() => {
    return mentions.filter((mention) => mention.platform === 'WEB' || mention.type === 'WEB_MENTION')
  }, [mentions])

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-lg font-semibold text-brand">Последние упоминания в сети</div>
          <div className="mt-1 text-sm leading-6 text-zinc-300">
            Реальные найденные страницы из WEB-сбора: отзовики, каталоги, статьи и внешние площадки.
          </div>
        </div>

        <div className="text-sm text-zinc-300">
          {isLoading ? 'Загружаем…' : `${visibleMentions.length} найдено`}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {isLoading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-white/10" />
            <div className="mt-4 h-10 animate-pulse rounded-2xl bg-white/10" />
          </div>
        ) : visibleMentions.length > 0 ? (
          visibleMentions.map((mention) => {
            const href = normalizeUrl(mention.url)
            const title = mention.title || mention.content || mention.url || 'Упоминание'
            const host = sourceHost(mention.url)
            const date = mention.publishedAt || mention.createdAt || null
            const isBusy = busyId === mention.id

            return (
              <div
                key={mention.id}
                className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/15 hover:bg-white/[0.04]"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-cyan-400/25 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-100">
                      WEB
                    </span>

                    <span className="text-sm text-zinc-300">{host}</span>
                  </div>

                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 text-base font-semibold leading-6 text-brand hover:text-blue-100"
                    >
                      {title}
                    </a>
                  ) : (
                    <div className="line-clamp-2 text-base font-semibold leading-6 text-brand">{title}</div>
                  )}

                  <div className="text-xs text-zinc-300">Найдено: {formatDate(date)}</div>
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => removeMention(mention)}
                  className="mt-4 w-full rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:border-red-300/30 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy ? 'Удаляем…' : 'Удалить упоминание'}
                </button>
              </div>
            )
          })
        ) : (
          <EmptyState
            title="Пока нет WEB-упоминаний"
            description="После успешного сканирования здесь появятся найденные страницы из сети."
          />
        )}
      </div>
    </Card>
  )
}
