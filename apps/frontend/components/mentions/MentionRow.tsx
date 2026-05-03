import { ReactNode } from 'react'
import clsx from 'clsx'
import Badge from '../ui/Badge'

export default function MentionRow({
  mention,
  actions
}: {
  mention: any
  actions?: ReactNode
}) {
  const publishedAt = mention.publishedAt ? new Date(mention.publishedAt) : null
  const publishedAtLabel =
    publishedAt && !Number.isNaN(publishedAt.getTime())
      ? mention.platform === 'TWOGIS'
        ? publishedAt.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        : publishedAt.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
      : 'Дата неизвестна'

  const numericRating =
    mention.ratingValue !== null && mention.ratingValue !== undefined
      ? Number(mention.ratingValue)
      : null

  const effectiveSentiment =
    numericRating !== null && Number.isFinite(numericRating)
      ? numericRating >= 4
        ? 'POSITIVE'
        : numericRating <= 2
          ? 'NEGATIVE'
          : 'NEUTRAL'
      : mention.sentiment

  const sourceUrl =
    mention.url ||
    mention.sourceUrl ||
    null

  const ratingBadgeClass =
    numericRating !== null && Number.isFinite(numericRating)
      ? numericRating >= 4
        ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.22)]'
        : numericRating <= 2
          ? 'border-red-400/30 bg-red-500/15 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.22)]'
          : 'border-amber-400/30 bg-amber-500/15 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
      : 'border-white/10 bg-white/10 text-brand'

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={mention.platform}>{mention.platform}</Badge>
            <Badge tone={effectiveSentiment}>{effectiveSentiment}</Badge>
            <Badge tone={mention.status}>{mention.status}</Badge>
            {mention.type ? <Badge>{mention.type}</Badge> : null}
            {numericRating !== null && Number.isFinite(numericRating) ? (
              <span
                className={clsx(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm',
                  ratingBadgeClass
                )}
              >
                {numericRating} ★
              </span>
            ) : null}
          </div>

          <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-brand">
            {mention.content}
          </div>

          <div className="mt-3 text-xs text-muted">
            {mention.author || 'Unknown'} · {publishedAtLabel}
          </div>
        </div>

        <div className="mt-2 flex flex-col items-start gap-2 sm:mt-0 sm:items-end sm:text-right">
          <div className="flex flex-wrap items-center gap-2">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300 transition-all hover:bg-cyan-400/20 hover:text-white"
              >
                Открыть источник →
              </a>
            ) : null}

            {actions ? actions : null}
          </div>
        </div>
      </div>
    </div>
  )
}
