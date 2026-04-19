'use client'

import { useMemo, useState } from 'react'
import MentionRow from '@/components/mentions/MentionRow'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { deleteMention, getCompanyMentions } from '@/lib/api/mentions'

const PAGE_LIMIT = 20

function getMentionSortTime(mention: any) {
  const publishedAt = mention?.publishedAt ? new Date(mention.publishedAt).getTime() : 0
  const createdAt = mention?.createdAt ? new Date(mention.createdAt).getTime() : 0

  if (Number.isFinite(publishedAt) && publishedAt > 0) {
    return publishedAt
  }

  return Number.isFinite(createdAt) ? createdAt : 0
}

function sortMentionsDesc(items: any[]) {
  return [...items].sort((a, b) => getMentionSortTime(b) - getMentionSortTime(a))
}

export default function InboxMentionsList({
  companyId,
  initialMentions,
  total
}: {
  companyId: string
  initialMentions: any[]
  total: number
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

  const hasMore = useMemo(() => mentions.length < totalCount, [mentions.length, totalCount])

  async function loadMore() {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    setError('')

    try {
      const nextPage = page + 1
      const response = await getCompanyMentions(
        companyId,
        `?page=${nextPage}&limit=${PAGE_LIMIT}`
      )

      const nextItems: any[] = Array.isArray(response?.data) ? response.data : []

      setMentions((current) => {
        const seen = new Set(current.map((item) => item?.id).filter(Boolean))
        const merged = [...current]

        for (const item of nextItems) {
          if (item?.id && seen.has(item.id)) continue
          if (item?.id) seen.add(item.id)
          merged.push(item)
        }

        return sortMentionsDesc(merged)
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

  if (!mentions.length) {
    return (
      <EmptyState
        title="Inbox пока пуст"
        description="Для этой компании пока не найдено упоминаний."
      />
    )
  }

  return (
    <div>
      <div className="space-y-3">
        {mentions.map((mention: any) => (
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
            {loadingMore ? 'Загрузка...' : `Показать ещё (${mentions.length} из ${totalCount})`}
          </Button>
        </div>
      ) : totalCount > PAGE_LIMIT ? (
        <div className="mt-4 text-center text-sm text-muted">
          Показаны все упоминания: {mentions.length}
        </div>
      ) : null}
    </div>
  )
}
