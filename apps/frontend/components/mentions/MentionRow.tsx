import { ReactNode } from 'react'
import clsx from 'clsx'
import Badge from '../ui/Badge'

function platformLabel(value?: string | null) {
  if (value === 'YANDEX') return 'Яндекс'
  if (value === 'TWOGIS') return '2GIS'
  if (value === 'VK') return 'VK'
  if (value === 'WEB') return 'Сеть'
  return value || null
}

function sentimentLabel(value?: string | null) {
  if (value === 'POSITIVE') return 'Позитив'
  if (value === 'NEGATIVE') return 'Негатив'
  if (value === 'NEUTRAL') return 'Нейтрально'
  return null
}

function statusLabel(value?: string | null) {
  if (value === 'NEW') return 'Новое'
  if (value === 'REVIEWED') return 'Обработано'
  if (value === 'ARCHIVED') return 'Архив'
  return null
}

function typeLabel(value?: string | null) {
  if (!value) return null

  const hiddenTypes = new Set([
    'REVIEW',
    'WEB_MENTION',
    'WEB_MENTION_FEED',
    'MENTION'
  ])

  if (hiddenTypes.has(value.toUpperCase())) return null
  if (value === 'VK_COMMENT') return 'Комментарий VK'

  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function getSourceHostname(sourceUrl?: string | null) {
  if (!sourceUrl) return null

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function getDomainLabel(hostname?: string | null) {
  if (!hostname) return '•'
  return hostname.slice(0, 1).toUpperCase()
}

function getFaviconUrl(sourceUrl?: string | null) {
  const hostname = getSourceHostname(sourceUrl)
  if (!hostname) return null

  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
}

export default function MentionRow({
  mention,
  actions,
  hideMetaBadges = false
}: {
  mention: any
  actions?: ReactNode
  hideMetaBadges?: boolean
}) {
  const publishedAt = mention.publishedAt ? new Date(mention.publishedAt) : null
  const publishedAtLabel =
    publishedAt && !Number.isNaN(publishedAt.getTime())
      ? publishedAt.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
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

  const faviconUrl = getFaviconUrl(sourceUrl)
  const sourceHostname = getSourceHostname(sourceUrl)

  const ratingBadgeClass =
    numericRating !== null && Number.isFinite(numericRating)
      ? numericRating >= 4
        ? 'border-emerald-400/30 bg-blue-500/15 text-emerald-200 shadow-[0_0_20px_rgba(99,102,241,0.34)]'
        : numericRating <= 2
          ? 'border-red-400/30 bg-red-500/15 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.22)]'
          : 'border-amber-400/30 bg-amber-500/15 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
      : 'border-white/10 bg-white/10 text-brand'

  const visibleBadges = hideMetaBadges
    ? []
    : [
        { tone: mention.platform, label: platformLabel(mention.platform) },
        { tone: effectiveSentiment, label: sentimentLabel(effectiveSentiment) },
        { tone: mention.status, label: statusLabel(mention.status) },
        { tone: undefined, label: typeLabel(mention.type) }
      ].filter((item) => item.label)

  return (
    <div className="rounded-2xl border border-line bg-[#050816] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {visibleBadges.length > 0 || (numericRating !== null && Number.isFinite(numericRating)) ? (
            <div className="flex flex-wrap items-center gap-2">
                {sourceHostname ? (
                  <span
                    title={sourceHostname}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet-400/40 bg-cyan-400/10 text-[10px] font-bold text-blue-100 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
                  >
                    {faviconUrl ? (
                      <img
                        src={faviconUrl}
                        alt=""
                        width={16}
                        height={16}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-4 w-4 rounded-sm"
                      />
                    ) : (
                      getDomainLabel(sourceHostname)
                    )}
                  </span>
                ) : null}

              {visibleBadges.map((badge) => (
                <Badge key={`${badge.tone || 'type'}-${badge.label}`} tone={badge.tone}>
                  {badge.label}
                </Badge>
              ))}

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
          ) : null}

          {mention.title ? (
            <div className="mt-3 break-words text-sm font-semibold text-brand">
              {mention.title}
            </div>
          ) : null}

          <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-brand">
            {mention.content}
          </div>

          <div className="mt-3 text-xs text-zinc-300">
            {mention.author || 'Источник'} · {publishedAtLabel}
          </div>
        </div>

        <div className="mt-2 flex flex-col items-start gap-2 sm:mt-0 sm:items-end sm:text-right">
          <div className="flex flex-wrap items-center gap-2">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs text-blue-300 transition-all hover:bg-cyan-400/20 hover:text-white"
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
