'use client'

import MentionRow from '@/components/mentions/MentionRow'
import EmptyState from '@/components/ui/EmptyState'

const PREVIEW_LIMIT = 3

export default function VkMentionsList({
  initialMentions,
  total
}: {
  companyId: string
  initialMentions: any[]
  total: number
}) {
  const mentions = Array.isArray(initialMentions)
    ? initialMentions.slice(0, PREVIEW_LIMIT)
    : []

  if (!mentions.length) {
    return (
      <EmptyState
        title="Комментариев и упоминаний пока нет"
        description="Здесь будут появляться реальные VK mentions сразу после успешной обработки мониторинга."
      />
    )
  }

  return (
    <div>
      <div className="relative overflow-hidden">
        <div className="space-y-3">
          {mentions.map((mention: any) => (
            <MentionRow key={mention.id} mention={mention} />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[#050b12]" />
      </div>

      {total > mentions.length ? (
        <div className="mt-4 text-center text-sm text-muted">
          Показаны последние {mentions.length} из {total}. Полный список доступен во Входящих.
        </div>
      ) : (
        <div className="mt-4 text-center text-sm text-muted">
          Показаны все VK-упоминания: {mentions.length}
        </div>
      )}
    </div>
  )
}
