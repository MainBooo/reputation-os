'use client'

import { useMemo, useState } from 'react'
import MentionRow from '@/components/mentions/MentionRow'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { getCompanyMentions } from '@/lib/api/mentions'

const PAGE_LIMIT = 20

export default function InboxMentionsList({
  companyId,
  initialMentions,
  total
}: {
  companyId: string
  initialMentions: any[]
  total: number
}) {
  const [mentions, setMentions] = useState<any[]>(Array.isArray(initialMentions) ? initialMentions : [])
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const hasMore = useMemo(() => mentions.length < total, [mentions.length, total])

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

        return merged
      })

      setPage(nextPage)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить ещё упоминания')
    } finally {
      setLoadingMore(false)
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
          <MentionRow key={mention.id} mention={mention} />
        ))}
      </div>

      {error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="secondary" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? 'Загрузка...' : `Показать ещё (${mentions.length} из ${total})`}
          </Button>
        </div>
      ) : total > PAGE_LIMIT ? (
        <div className="mt-4 text-center text-sm text-muted">
          Показаны все упоминания: {mentions.length}
        </div>
      ) : null}
    </div>
  )
}
