'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import Badge from '../ui/Badge'
import MentionChatPanel from '@/components/chat/MentionChatPanel'
import { generateReply } from '@/lib/api/mentions'

type ReplyPreset = 'FORMAL' | 'FRIENDLY' | 'CONCISE'

const REPLY_PRESETS: Array<{ value: ReplyPreset; label: string; hint: string }> = [
  { value: 'FORMAL', label: 'Официальный', hint: 'Сдержанно, официально-деловой тон' },
  { value: 'FRIENDLY', label: 'Дружелюбный', hint: 'Тепло и по-человечески' },
  { value: 'CONCISE', label: 'Кратко', hint: '1-2 предложения, только суть' }
]

function getYandexReviewDeepLink(mention: any): string | null {
  if (mention?.platform !== 'YANDEX' || !mention?.authorExternalId) return null

  const orgId = String(mention.url || '').match(/\/maps\/org\/[^/]+\/(\d+)/)?.[1]
  if (!orgId) return null

  return `https://yandex.ru/maps/org/${orgId}/reviews?reviews%5BpublicId%5D=${encodeURIComponent(mention.authorExternalId)}&utm_source=review`
}

function platformLabel(value?: string | null) {
  if (value === 'YANDEX') return 'Яндекс'
  if (value === 'TWOGIS') return '2GIS'
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

function sourceTypeLabel(mention: any, hostname?: string | null) {
  const type = String(mention?.type || '').toUpperCase()
  const platform = String(mention?.platform || '').toUpperCase()
  const host = String(hostname || '').toLowerCase()

  if (platform === 'YANDEX' || platform === 'TWOGIS') return 'Отзыв'

  if (
    host.includes('tripadvisor') ||
    host.includes('zoon') ||
    host.includes('restoclub') ||
    host.includes('restaurantguru') ||
    host.includes('flamp')
  ) {
    return 'Справочник'
  }

  if (
    type.includes('ARTICLE') ||
    host.includes('vc.ru') ||
    host.includes('dzen') ||
    host.includes('habr') ||
    host.includes('medium')
  ) {
    return 'Статья'
  }

  if (type.includes('REVIEW')) return 'Отзыв'

  return 'Упоминание'
}

function getFaviconUrl(sourceUrl?: string | null) {
  const hostname = getSourceHostname(sourceUrl)
  if (!hostname) return null

  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
}

export default function MentionRow({
  mention,
  actions,
  checkbox,
  hideMetaBadges = false,
  workspaceId
}: {
  mention: any
  actions?: ReactNode
  checkbox?: ReactNode
  hideMetaBadges?: boolean
  workspaceId?: string
}) {
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [copied, setCopied] = useState(false)
  const [presetMenuOpen, setPresetMenuOpen] = useState(false)
  const presetMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!presetMenuOpen) return

    function onMouseDown(event: MouseEvent) {
      if (presetMenuRef.current && !presetMenuRef.current.contains(event.target as Node)) {
        setPresetMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [presetMenuOpen])

  const publishedAt = mention.publishedAt ? new Date(mention.publishedAt) : null
  const publishedAtLabel =
    publishedAt && !Number.isNaN(publishedAt.getTime())
      ? publishedAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Дата неизвестна'

  const numericRating = mention.ratingValue !== null && mention.ratingValue !== undefined ? Number(mention.ratingValue) : null
  const effectiveSentiment =
    numericRating !== null && Number.isFinite(numericRating)
      ? numericRating >= 4 ? 'POSITIVE' : numericRating <= 2 ? 'NEGATIVE' : 'NEUTRAL'
      : mention.sentiment

  const sourceUrl = mention.url || mention.sourceUrl || null
  const yandexDeepLink = getYandexReviewDeepLink(mention)
  const faviconUrl = getFaviconUrl(sourceUrl)
  const sourceHostname = getSourceHostname(sourceUrl)
  const readableSourceType = sourceTypeLabel(mention, sourceHostname)

  async function handleGenerateReply(preset?: ReplyPreset) {
    if (!mention?.id || replyLoading) return
    setPresetMenuOpen(false)
    setReplyLoading(true)
    setReplyError('')
    setCopied(false)

    try {
      const draft = await generateReply(mention.id, preset)
      setReplyText(draft?.draftText || '')
    } catch {
      setReplyError('Не удалось сгенерировать ответ')
    } finally {
      setReplyLoading(false)
    }
  }

  async function handleCopyReply() {
    if (!replyText) return
    try {
      await navigator.clipboard.writeText(replyText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setReplyError('Не удалось скопировать ответ')
    }
  }

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
        mention.platform !== 'WEB' ? { tone: mention.platform, label: platformLabel(mention.platform) } : null,
        { tone: effectiveSentiment, label: sentimentLabel(effectiveSentiment) },
        { tone: mention.status, label: statusLabel(mention.status) },
        { tone: undefined, label: typeLabel(mention.type) }
      ].filter((item): item is { tone: any; label: string } => Boolean(item?.label))

  return (
    <div className="rounded-2xl border border-line bg-[#050816] p-4 sm:p-5">
    <div className="flex gap-3">
    {checkbox ? <div className="shrink-0 pt-0.5">{checkbox}</div> : null}
    <div className="min-w-0 flex-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {sourceHostname ? (
              <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                <span title={sourceHostname} className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-400/40 bg-cyan-400/10 text-[10px] font-bold text-blue-100">
                  {faviconUrl ? <img src={faviconUrl} alt="" width={16} height={16} loading="lazy" referrerPolicy="no-referrer" className="h-4 w-4 rounded-sm" /> : getDomainLabel(sourceHostname)}
                </span>
                <span className="truncate text-xs font-medium text-zinc-200">{sourceHostname}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">{readableSourceType}</span>
              </div>
            ) : null}

            {visibleBadges.map((badge) => (
              <Badge key={`${badge.tone || 'type'}-${badge.label}`} tone={badge.tone}>
                {badge.label}
              </Badge>
            ))}

            {numericRating !== null && Number.isFinite(numericRating) ? (
              <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm', ratingBadgeClass)}>
                {numericRating} ★
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {yandexDeepLink ? (
            <a href={yandexDeepLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs text-blue-300 transition-all hover:bg-cyan-400/20 hover:text-white">
              Открыть отзыв →
            </a>
          ) : sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs text-blue-300 transition-all hover:bg-cyan-400/20 hover:text-white">
              Открыть источник →
            </a>
          ) : null}

          <div ref={presetMenuRef} className="relative inline-flex">
            <button type="button" onClick={() => handleGenerateReply()} disabled={replyLoading} className="inline-flex items-center gap-1 rounded-l-md border border-r-0 border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200 transition-all hover:bg-cyan-400/20 hover:text-white disabled:opacity-60">
              {replyLoading ? 'Генерация…' : replyText ? 'Сгенерировать заново' : 'AI ответ'}
            </button>
            <button
              type="button"
              onClick={() => setPresetMenuOpen((prev) => !prev)}
              disabled={replyLoading}
              aria-label="Выбрать тон ответа"
              aria-expanded={presetMenuOpen}
              className="inline-flex items-center rounded-r-md border border-cyan-400/40 bg-cyan-400/10 px-1.5 py-1 text-xs text-cyan-200 transition-all hover:bg-cyan-400/20 hover:text-white disabled:opacity-60"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {presetMenuOpen ? (
              <>
                <div className="fixed inset-0 z-[70] bg-black/50 sm:hidden" onClick={() => setPresetMenuOpen(false)} />
                <div className="fixed inset-x-0 bottom-0 z-[80] rounded-t-2xl border border-white/10 bg-[#07111f] p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(0,0,0,0.7)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-1 sm:w-64 sm:rounded-xl sm:pb-2">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:pt-1">Тон ответа</div>
                  {REPLY_PRESETS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleGenerateReply(item.value)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-cyan-400/10 sm:py-2"
                    >
                      <span className="text-sm text-cyan-100 sm:text-xs">{item.label}</span>
                      <span className="text-xs text-zinc-500 sm:text-[11px]">{item.hint}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {actions ? actions : null}
        </div>
      </div>

      {mention.title ? <div className="mt-3 break-words text-sm font-semibold text-brand">{mention.title}</div> : null}

      <div className="mt-3 w-full whitespace-pre-wrap break-words text-sm leading-6 text-brand">{mention.content}</div>

      <div className="mt-3 text-xs text-zinc-300">{mention.author || 'Источник'} · {publishedAtLabel}</div>

      {replyError ? (
        <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{replyError}</div>
      ) : null}

      {replyText ? (
        <div className="mt-4 w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Ответ от AI</div>
          <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{replyText}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleCopyReply} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
              {copied ? 'Скопировано' : 'Скопировать'}
            </button>
          </div>
        </div>
      ) : null}

      {mention?.id && workspaceId ? (
        <div className="mt-4">
          <MentionChatPanel mentionId={mention.id} workspaceId={workspaceId} />
        </div>
      ) : null}
    </div>
    </div>
    </div>
  )
}
