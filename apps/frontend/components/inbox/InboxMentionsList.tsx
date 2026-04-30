'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import clsx from 'clsx'
import MentionRow from '@/components/mentions/MentionRow'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import InboxPendingRefresh from '@/components/inbox/InboxPendingRefresh'
import { deleteMention, getCompanyMentions } from '@/lib/api/mentions'

const PAGE_LIMIT = 20
const PLATFORM_FILTERS = ['YANDEX', 'VK', 'TWO_GIS']
const SENTIMENT_FILTERS = ['NEGATIVE', 'POSITIVE', 'NEUTRAL']
const RATING_FILTERS = [1, 2, 3, 4, 5]

function platformLabel(value: string) {
  if (value === 'TWO_GIS') return '2GIS'
  return value
}

function sentimentLabel(value: string) {
  if (value === 'NEGATIVE') return 'Негатив'
  if (value === 'POSITIVE') return 'Позитив'
  if (value === 'NEUTRAL') return 'Нейтрал'
  return value
}

function getMentionSortTime(mention: any) {
  const publishedAt = mention?.publishedAt ? new Date(mention.publishedAt).getTime() : 0
  const createdAt = mention?.createdAt ? new Date(mention.createdAt).getTime() : 0
  if (Number.isFinite(publishedAt) && publishedAt > 0) return publishedAt
  return Number.isFinite(createdAt) ? createdAt : 0
}

function sortMentionsDesc(items: any[]) {
  return [...items].sort((a, b) => getMentionSortTime(b) - getMentionSortTime(a))
}

function mergeMentions(current: any[], incoming: any[]) {
  const seen = new Set(current.map((item) => item?.id).filter(Boolean))
  const merged = [...current]

  for (const item of incoming) {
    if (item?.id && seen.has(item.id)) continue
    if (item?.id) seen.add(item.id)
    merged.push(item)
  }

  return sortMentionsDesc(merged)
}

function mentionMatchesFilters(
  mention: any,
  filters: {
    platform: string
    sentiment: string
    rating: number | null
    from: string
    to: string
  }
) {
  if (filters.platform && mention?.platform !== filters.platform) return false

  const numericRating =
    mention?.ratingValue !== null && mention?.ratingValue !== undefined
      ? Number(mention.ratingValue)
      : null

  const hasNumericRating = numericRating !== null && Number.isFinite(numericRating)

  const effectiveSentiment =
    hasNumericRating
      ? numericRating >= 4
        ? 'POSITIVE'
        : numericRating <= 2
          ? 'NEGATIVE'
          : 'NEUTRAL'
      : mention?.sentiment

  if (filters.sentiment && effectiveSentiment !== filters.sentiment) return false

  if (filters.rating) {
    if (!Number.isFinite(numericRating) || numericRating !== filters.rating) return false
  }

  if (filters.from || filters.to) {
    const rawDate = mention?.publishedAt || mention?.createdAt
    const publishedAt = rawDate ? new Date(rawDate) : null

    if (!publishedAt || Number.isNaN(publishedAt.getTime())) return false

    if (filters.from) {
      const fromDate = new Date(filters.from)
      if (!Number.isNaN(fromDate.getTime()) && publishedAt < fromDate) return false
    }

    if (filters.to) {
      const toDate = new Date(filters.to)
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999)
        if (publishedAt > toDate) return false
      }
    }
  }

  return true
}

export default function InboxMentionsList({
  companyId,
  initialMentions,
  total,
  initialAverageRating,
  initialRatedCount,
  isAwaitingInitialYandexData,
  initialFilters
}: {
  companyId: string
  initialMentions: any[]
  total: number
  initialAverageRating?: number | null
  initialRatedCount?: number
  isAwaitingInitialYandexData?: boolean
  initialFilters?: {
    platform?: string
    sentiment?: string
    rating?: number | null
    from?: string
    to?: string
  }
}) {
  const [mentions, setMentions] = useState<any[]>(
    sortMentionsDesc(Array.isArray(initialMentions) ? initialMentions : [])
  )
  const [totalCount, setTotalCount] = useState<number>(
    Math.max(total, Array.isArray(initialMentions) ? initialMentions.length : 0)
  )
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [error, setError] = useState('')
  const [initialLoadTimedOut, setInitialLoadTimedOut] = useState(false)
  const [platform, setPlatform] = useState(initialFilters?.platform || '')
  const [sentiment, setSentiment] = useState(initialFilters?.sentiment || '')
  const [rating, setRating] = useState<number | null>(initialFilters?.rating || null)
  const [from, setFrom] = useState(initialFilters?.from || '')
  const [to, setTo] = useState(initialFilters?.to || '')
  const [averageRating, setAverageRating] = useState<number | null>(
    initialAverageRating === null || initialAverageRating === undefined ? null : Number(initialAverageRating)
  )
  const [ratedCount, setRatedCount] = useState(Number(initialRatedCount || 0))
  const requestIdRef = useRef(0)

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('limit', String(PAGE_LIMIT))
    if (platform) params.set('platform', platform)
    if (sentiment) params.set('sentiment', sentiment)
    if (rating) params.set('rating', String(rating))
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return `?${params.toString()}`
  }, [platform, sentiment, rating, from, to])

  const hasActiveFilters = Boolean(platform || sentiment || rating || from || to)
  const visibleMentions = useMemo(
    () => mentions.filter((mention) => mentionMatchesFilters(mention, { platform, sentiment, rating, from, to })),
    [mentions, platform, sentiment, rating, from, to]
  )
  const visibleCount = visibleMentions.length
  const hasMore = useMemo(() => mentions.length < totalCount, [mentions.length, totalCount])

  useEffect(() => {
    const incoming = Array.isArray(initialMentions) ? initialMentions : []
    if (incoming.length > 0) setMentions((current) => mergeMentions(current, incoming))
    setTotalCount((current) => Math.max(current, total || 0, incoming.length))
  }, [initialMentions, total])

  useEffect(() => {
    requestIdRef.current += 1
    const requestId = requestIdRef.current
    let cancelled = false

    async function fetchFirstPage(replace = false) {
      try {
        if (replace) {
          setError('')
          setMentions([])
          setTotalCount(0)
          setPage(1)
        }

        const res = await getCompanyMentions(companyId, filterQuery)
        if (cancelled || requestId !== requestIdRef.current) return

        const items: any[] = Array.isArray(res?.data) ? res.data : []
        const nextTotal = Number(res?.meta?.total || 0)
        const nextAverage = res?.meta?.averageRating
        const nextRatedCount = Number(res?.meta?.ratedCount || 0)

        setTotalCount(Math.max(nextTotal, items.length))
        setAverageRating(nextAverage === null || nextAverage === undefined ? null : Number(nextAverage))
        setRatedCount(nextRatedCount)

        if (replace) {
          setMentions(sortMentionsDesc(items))
          setPage(1)
        } else if (items.length > 0) {
          setMentions((current) => {
            if (current.length > PAGE_LIMIT) return current
            return mergeMentions(current, items)
          })
        }

        if (items.length > 0) setInitialLoadTimedOut(false)
      } catch (e) {
        if (!cancelled && replace) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить упоминания')
        }
      }
    }

    fetchFirstPage(true)
    const interval = setInterval(() => fetchFirstPage(false), 2000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [companyId, filterQuery])

  async function loadMore() {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    setError('')

    try {
      const nextPage = page + 1
      const params = new URLSearchParams(filterQuery.slice(1))
      params.set('page', String(nextPage))
      params.set('limit', String(PAGE_LIMIT))

      const response = await getCompanyMentions(companyId, `?${params.toString()}`)
      const nextItems: any[] = Array.isArray(response?.data) ? response.data : []
      const nextTotal = Number(response?.meta?.total || 0)

      setMentions((current) => {
        const merged = mergeMentions(current, nextItems)
        setTotalCount(Math.max(nextTotal, merged.length))
        return merged
      })
      setPage(nextPage)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить ещё упоминания')
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleDelete(mentionId: string) {
    if (!mentionId || removingId) return

    setRemovingId(mentionId)
    setError('')

    try {
      await deleteMention(mentionId)
      setMentions((current) => current.filter((item) => item?.id !== mentionId))
      setTotalCount((current) => Math.max(0, current - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить упоминание')
    } finally {
      setRemovingId('')
    }
  }

  function resetFilters() {
    setPlatform('')
    setSentiment('')
    setRating(null)
    setFrom('')
    setTo('')
  }

  const ratingLabel = averageRating === null ? '—' : `${averageRating.toFixed(1)} ★`

  return (
    <div>
      <Card className="mb-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-muted">Средний рейтинг по отзывам</div>
            <div className="mt-1 text-3xl font-semibold text-brand">{ratingLabel}</div>
            <div className="mt-1 text-xs text-muted">На основе {ratedCount} отзывов с оценкой</div>
          </div>

          <div className="text-sm text-muted">
            Найдено: <span className="text-brand">{totalCount}</span>
          </div>
        </div>
      </Card>

      <Card className="mb-6 p-5">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">Площадка</div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPlatform(platform === item ? '' : item)}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                    platform === item
                      ? 'border-amber-400/40 bg-amber-500/20 text-amber-100'
                      : 'border-white/10 bg-white/[0.04] text-muted hover:text-brand'
                  )}
                >
                  {platformLabel(item)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">Тональность</div>
            <div className="flex flex-wrap gap-2">
              {SENTIMENT_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSentiment(sentiment === item ? '' : item)}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                    sentiment === item
                      ? item === 'NEGATIVE'
                        ? 'border-red-400/30 bg-red-500/15 text-red-200'
                        : item === 'POSITIVE'
                          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
                          : 'border-amber-400/30 bg-amber-500/15 text-amber-100'
                      : 'border-white/10 bg-white/[0.04] text-muted hover:text-brand'
                  )}
                >
                  {sentimentLabel(item)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">Оценка</div>
            <div className="flex flex-wrap gap-2">
              {RATING_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRating(rating === item ? null : item)}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                    rating === item
                      ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
                      : 'border-white/10 bg-white/[0.04] text-muted hover:text-brand'
                  )}
                >
                  {item} ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">Дата публикации</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-12 rounded-xl border border-line bg-panel px-4 text-sm text-brand outline-none transition focus:border-cyan-400/50"
              />
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-12 rounded-xl border border-line bg-panel px-4 text-sm text-brand outline-none transition focus:border-cyan-400/50"
              />
            </div>
          </div>

          {hasActiveFilters ? (
            <Button type="button" variant="secondary" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          ) : null}
        </div>
      </Card>

      {!mentions.length && (isAwaitingInitialYandexData || totalCount > 0) && (!initialLoadTimedOut || totalCount > 0) ? (
        <>
          <InboxPendingRefresh
            companyId={companyId}
            enabled
            onTimeout={() => setInitialLoadTimedOut(true)}
          />

          <Card className="p-5">
            <div className="mb-2 text-base font-semibold">Загружаем данные из Яндекс Карт</div>
            <div className="text-sm text-muted">Первые отзывы появятся здесь автоматически.</div>
            <div className="mt-4 space-y-3">
              <div className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
            </div>
          </Card>
        </>
      ) : !mentions.length ? (
        <EmptyState
          title={initialLoadTimedOut ? 'Данные из Яндекс Карт пока не получены' : 'Inbox пока пуст'}
          description={
            hasActiveFilters
              ? 'По выбранным фильтрам ничего не найдено.'
              : initialLoadTimedOut
                ? 'Первичная загрузка не вернула отзывы. Проверьте ссылку на Яндекс Карты или дождитесь следующей синхронизации.'
                : 'Для этой компании пока не найдено упоминаний.'
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {visibleMentions.map((mention: any) => (
              <MentionRow
                key={mention.id}
                mention={mention}
                actions={
                  <button
                    type="button"
                    disabled={removingId === mention.id}
                    onClick={() => handleDelete(mention.id)}
                    className="inline-flex items-center justify-center rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-300 transition-all hover:bg-red-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {removingId === mention.id ? 'Удаление...' : 'Удалить'}
                  </button>
                }
              />
            ))}
          </div>

          {error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}

          {hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="secondary" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? 'Загрузка...' : `Показать ещё (${Math.min(visibleCount || mentions.length, totalCount)} из ${totalCount})`}
              </Button>
            </div>
          ) : totalCount > PAGE_LIMIT ? (
            <div className="mt-4 text-center text-sm text-muted">
              Показаны все упоминания: {Math.min(visibleCount || mentions.length, totalCount)} из {totalCount}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
