import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import DashboardCharts from '@/components/dashboard/DashboardCharts'
import { getCompanies } from '@/lib/api/companies'
import { getCompanyMentions } from '@/lib/api/mentions'
import { BriefcaseBusiness, Radar, MessageSquareText, Star, BellRing, Activity, Inbox, Plus, Building2, ArrowRight, AlertTriangle, ShieldCheck, Clock3, ExternalLink, type LucideIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

const CHART_DAYS = 30

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatShortDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

function getSourceUrl(mention: any) {
  return mention?.url || mention?.sourceUrl || null
}

function getSourceHostname(sourceUrl?: string | null) {
  if (!sourceUrl) return null

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function getFaviconUrl(sourceUrl?: string | null) {
  const hostname = getSourceHostname(sourceUrl)
  if (!hostname) return null

  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
}

function getMentionsCount(company: any) {
  return toNumber(company?._count?.mentions)
}

function getDashboardCompany(companies: any[]) {
  return companies
    .slice()
    .sort((a, b) => getMentionsCount(b) - getMentionsCount(a))[0] || null
}

function getAliases(company: any) {
  return Array.isArray(company?.aliases) ? company.aliases.filter(Boolean) : []
}

function getSourceTargets(company: any) {
  return Array.isArray(company?.sourceTargets) ? company.sourceTargets.filter(Boolean) : []
}

function getActiveSourceTargets(company: any) {
  return getSourceTargets(company).filter((target: any) => target?.isActive !== false)
}

function getPlatformList(company: any) {
  return Array.from(
    new Set(
      getActiveSourceTargets(company)
        .map((target: any) => target?.source?.platform)
        .filter(Boolean)
    )
  ) as string[]
}

function getMentionRating(mention: any) {
  const rating =
    mention?.ratingValue !== null && mention?.ratingValue !== undefined
      ? Number(mention.ratingValue)
      : null

  return rating !== null && Number.isFinite(rating) ? rating : null
}

function getMentionSentiment(mention: any) {
  const rating = getMentionRating(mention)

  if (rating !== null) {
    if (rating >= 4) return 'POSITIVE'
    if (rating <= 2) return 'NEGATIVE'
    return 'NEUTRAL'
  }

  return mention?.sentiment || 'UNKNOWN'
}

function sentimentLabel(value: string) {
  if (value === 'POSITIVE') return 'Позитивный'
  if (value === 'NEGATIVE') return 'Негативный'
  if (value === 'NEUTRAL') return 'Нейтральный'
  return 'Неизвестно'
}

function sentimentTone(value: string) {
  if (value === 'POSITIVE') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
  if (value === 'NEGATIVE') return 'border-red-400/25 bg-red-500/10 text-red-200'
  if (value === 'NEUTRAL') return 'border-amber-400/25 bg-amber-500/10 text-amber-100'
  return 'border-white/10 bg-white/5 text-muted'
}

function truncate(value: string, limit = 72) {
  if (!value) return ''
  if (value.length <= limit) return value
  return `${value.slice(0, limit).trim()}…`
}


function getPlatformLabel(platform?: string) {
  if (platform === 'YANDEX') return 'Яндекс'
  if (platform === 'TWOGIS') return '2GIS'
  if (platform === 'WEB') return 'Web'
  return 'Источник'
}

function getMentionTitle(mention: any) {
  if (mention?.title?.trim()) return truncate(mention.title, 64)
  if (mention?.author?.trim()) return `Отзыв: ${truncate(mention.author, 44)}`
  return 'Новое упоминание'
}

function getMentionSourceName(mention: any) {
  if (mention?.platform === 'WEB') return 'Внешний источник'
  return getPlatformLabel(mention?.platform)
}

function getCompanyStatus(company: any) {
  const sourcesCount = getActiveSourceTargets(company).length
  const mentionsCount = getMentionsCount(company)

  if (sourcesCount === 0) return 'Требует настройки'
  if (mentionsCount === 0) return 'Ожидает данные'
  return 'Активен'
}

function getStatusTone(company: any) {
  const status = getCompanyStatus(company)
  if (status === 'Активен') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
  if (status === 'Ожидает данные') return 'border-amber-400/25 bg-amber-500/10 text-amber-100'
  return 'border-red-400/25 bg-red-500/10 text-red-200'
}

function buildLastDays() {
  const result: string[] = []
  const now = new Date()

  for (let index = CHART_DAYS - 1; index >= 0; index -= 1) {
    const date = new Date(now)
    date.setDate(now.getDate() - index)
    result.push(date.toISOString().slice(0, 10))
  }

  return result
}

function getMentionActivityDate(mention: any) {
  return mention?.discoveredAt || mention?.createdAt || mention?.publishedAt || null
}

function buildMentionTrend(mentions: any[]) {
  const days = buildLastDays()
  const map = new Map(days.map((day) => [day, 0]))

  for (const mention of mentions) {
    const activityDateRaw = getMentionActivityDate(mention)
    const activityDate = activityDateRaw ? new Date(activityDateRaw) : null
    if (!activityDate || Number.isNaN(activityDate.getTime())) continue

    const key = activityDate.toISOString().slice(0, 10)
    if (map.has(key)) {
      map.set(key, (map.get(key) || 0) + 1)
    }
  }

  const values = days.map((day) => map.get(day) || 0)
  const smoothedValues = values.map((value, index) => {
    const previous = values[index - 1] ?? value
    const next = values[index + 1] ?? value
    return Math.round((previous + value * 2 + next) / 4)
  })

  return days.map((day, index) => ({
    date: day,
    label: formatShortDate(day),
    value: smoothedValues[index],
    rawValue: values[index]
  }))
}

function buildRatingTrend(mentions: any[], averageRating: number | null) {
  const days = buildLastDays()
  const grouped = new Map(days.map((day) => [day, [] as number[]]))

  for (const mention of mentions) {
    const platform = String(mention?.platform || '').toUpperCase()

    if (!['YANDEX', 'TWOGIS'].includes(platform)) {
      continue
    }

    const rating =
      mention?.ratingValue !== null && mention?.ratingValue !== undefined
        ? Number(mention.ratingValue)
        : null

    if (rating === null || !Number.isFinite(rating)) continue

    const activityDateRaw =
      mention?.discoveredAt || mention?.createdAt || mention?.publishedAt || null

    const activityDate = activityDateRaw ? new Date(activityDateRaw) : null

    if (!activityDate || Number.isNaN(activityDate.getTime())) continue

    const key = activityDate.toISOString().slice(0, 10)

    if (grouped.has(key)) {
      grouped.get(key)?.push(rating)
    }
  }

  let previousAverage = 4.1

  const values = days.map((day) => {
    const ratings = grouped.get(day) || []

    if (!ratings.length) {
      return previousAverage
    }

    const avg =
      ratings.reduce((sum, value) => sum + value, 0) / ratings.length

    previousAverage =
      Number(((previousAverage * 0.82) + (avg * 0.18)).toFixed(2))

    return previousAverage
  })

  return days.map((day, index) => {
    const finalAverage =
      averageRating !== null &&
      Number.isFinite(averageRating) &&
      index === days.length - 1
        ? Number(averageRating.toFixed(2))
        : values[index]

    return {
      date: day,
      label: formatShortDate(day),
      value: finalAverage,
      rawValue: finalAverage
    }
  })
    .filter((point): point is { date: string; label: string; value: number; rawValue: number } => point !== null)
}


function KpiCard({
  Icon,
  label,
  value,
  hint,
  tone
}: {
  Icon: LucideIcon
  label: string
  value: string
  hint: string
  tone: 'cyan' | 'emerald' | 'violet' | 'amber'
}) {
  const toneClass = {
    cyan: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200 shadow-[0_0_34px_rgba(34,211,238,0.22)]',
    emerald: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200 shadow-[0_0_34px_rgba(52,211,153,0.18)]',
    violet: 'border-violet-400/35 bg-violet-500/10 text-violet-200 shadow-[0_0_34px_rgba(139,92,246,0.18)]',
    amber: 'border-amber-400/35 bg-amber-500/10 text-amber-100 shadow-[0_0_34px_rgba(251,191,36,0.18)]'
  }[tone]

  const glowClass = {
    cyan: 'from-cyan-400/25',
    emerald: 'from-emerald-400/20',
    violet: 'from-violet-400/20',
    amber: 'from-amber-400/20'
  }[tone]

  const barClass = {
    cyan: 'from-cyan-500/40 to-cyan-200',
    emerald: 'from-emerald-500/40 to-emerald-200',
    violet: 'from-violet-500/40 to-violet-200',
    amber: 'from-amber-500/40 to-amber-200'
  }[tone]

  return (
    <Card className="group relative min-h-[178px] overflow-hidden rounded-[26px] border border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.36)] transition hover:-translate-y-0.5 hover:border-cyan-300/20 hover:shadow-[0_26px_90px_rgba(0,0,0,0.44),0_0_54px_rgba(34,211,238,0.12)]">
      <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.13),transparent_34%)] opacity-80`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${glowClass} via-white/25 to-transparent`} />

      <div className="relative flex items-start justify-between gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border ${toneClass}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>

        <div className="mt-1 flex h-9 items-end gap-1.5 opacity-90">
          {[14, 20, 27, 34, 42].map((height, index) => (
            <span
              key={index}
              className={`w-1.5 rounded-full bg-gradient-to-t ${barClass} shadow-[0_0_10px_currentColor]`}
              style={{ height }}
            />
          ))}
        </div>
      </div>

      <div className="relative mt-6 text-sm text-slate-400">{label}</div>
      <div className="relative mt-2 text-[36px] font-semibold leading-none tracking-[-0.05em] text-white">{value}</div>
      <div className="relative mt-3 truncate text-sm font-medium text-emerald-300">{hint}</div>
    </Card>
  )
}
export default async function DashboardPage() {
  let companies: any[] = []
  let dashboardMentions: any[] = []
  let dashboardMeta: any = { total: 0, averageRating: null, ratedCount: 0 }
  let authRequired = false

  try {
    const companiesResult = await getCompanies()
    companies = Array.isArray(companiesResult) ? companiesResult : []

    const dashboardCompany = getDashboardCompany(companies)
    if (dashboardCompany?.id) {
      const mentionsResult = await getCompanyMentions(dashboardCompany.id, '?page=1&limit=250')
      dashboardMentions = Array.isArray(mentionsResult?.data)
        ? mentionsResult.data.filter((mention: any) => mention?.platform !== 'VK')
        : []
      dashboardMeta = mentionsResult?.meta || dashboardMeta
    }
  } catch {
    authRequired = true
  }

  if (authRequired) {
    return (
      <div>
        <PageHeader
          title="Панель управления"
          subtitle="Краткий обзор репутации, отзывов, упоминаний и активности источников."
        />
        <EmptyState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить панель управления."
        />
      </div>
    )
  }

  const firstCompany = getDashboardCompany(companies)
  const totalCompanies = companies.length
  const totalSources = companies.reduce((sum, company) => sum + getActiveSourceTargets(company).length, 0)
  const totalMentions = toNumber(
    dashboardMeta?.total || companies.reduce((sum, company) => sum + getMentionsCount(company), 0)
  )
  const averageRating =
    dashboardMeta?.averageRating === null || dashboardMeta?.averageRating === undefined
      ? null
      : Number(dashboardMeta.averageRating)

  const platformCounts = new Map<string, number>()

  for (const mention of dashboardMentions) {
    if (!mention?.platform) continue
    platformCounts.set(mention.platform, (platformCounts.get(mention.platform) || 0) + 1)
  }

  if (platformCounts.size === 0) {
    for (const company of companies) {
      for (const platform of getPlatformList(company)) {
        platformCounts.set(platform, (platformCounts.get(platform) || 0) + getMentionsCount(company))
      }
    }
  }

  const platforms = Array.from(platformCounts.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count)

  const sentimentCounts = dashboardMentions.reduce(
    (acc, mention) => {
      const sentiment = getMentionSentiment(mention)
      if (sentiment === 'POSITIVE') acc.positive += 1
      else if (sentiment === 'NEGATIVE') acc.negative += 1
      else acc.neutral += 1
      return acc
    },
    { positive: 0, neutral: 0, negative: 0 }
  )

  const latestMentions = dashboardMentions.slice(0, 3)
  const mentionTrend = buildMentionTrend(dashboardMentions)
  const mentionsInPeriod = mentionTrend.reduce((sum, point) => sum + point.value, 0)
  const ratingTrend = buildRatingTrend(dashboardMentions, averageRating)
  const ratingLabel = averageRating === null || Number.isNaN(averageRating) ? '—' : `${averageRating.toFixed(1)} ★`

  type AttentionItem = {
    title: string
    description: string
    meta: string
    tone: 'red' | 'amber' | 'emerald'
    href: string
  }

  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const since24h = new Date(now.getTime() - dayMs)
  const since7d = new Date(now.getTime() - dayMs * 7)
  const since14d = new Date(now.getTime() - dayMs * 14)

  const getDate = (mention: any) => {
    const raw = getMentionActivityDate(mention)
    const date = raw ? new Date(raw) : null
    return date && !Number.isNaN(date.getTime()) ? date : null
  }

  const isAfter = (mention: any, date: Date) => {
    const mentionDate = getDate(mention)
    return Boolean(mentionDate && mentionDate >= date)
  }

  const recent24h = dashboardMentions.filter((mention) => isAfter(mention, since24h))
  const recent7d = dashboardMentions.filter((mention) => isAfter(mention, since7d))
  const previous7d = dashboardMentions.filter((mention) => {
    const date = getDate(mention)
    return Boolean(date && date >= since14d && date < since7d)
  })

  const getAverageRating = (mentions: any[]) => {
    const ratings = mentions
      .map(getMentionRating)
      .filter((value): value is number => value !== null)

    if (!ratings.length) return null

    return ratings.reduce((sum, value) => sum + value, 0) / ratings.length
  }

  const negative24h = recent24h.filter((mention) => getMentionSentiment(mention) === 'NEGATIVE')
  const negative7d = recent7d.filter((mention) => getMentionSentiment(mention) === 'NEGATIVE')
  const previousNegative7d = previous7d.filter((mention) => getMentionSentiment(mention) === 'NEGATIVE')

  const lowRating24h = recent24h.filter((mention) => {
    const rating = getMentionRating(mention)
    return rating !== null && rating <= 2
  })

  const web24h = recent24h.filter((mention) => String(mention?.platform || '').toUpperCase() === 'WEB')
  const web7d = recent7d.filter((mention) => String(mention?.platform || '').toUpperCase() === 'WEB')

  const unrated24h = recent24h.filter((mention) => getMentionRating(mention) === null)
  const newUnprocessed24h = recent24h.filter((mention) => mention?.status === 'NEW')

  const current7dRating = getAverageRating(recent7d)
  const previous7dRating = getAverageRating(previous7d)
  const ratingDrop =
    current7dRating !== null && previous7dRating !== null
      ? previous7dRating - current7dRating
      : 0

  const attentionItems: AttentionItem[] = []

  if (ratingDrop >= 0.2) {
    attentionItems.push({
      title: 'Рейтинг начал снижаться',
      description: `Средняя оценка за 7 дней ниже предыдущего периода на ${ratingDrop.toFixed(1)}★.`,
      meta: ratingDrop >= 0.4 ? 'Высокий' : 'Средний',
      tone: ratingDrop >= 0.4 ? 'red' : 'amber',
      href: firstCompany ? `/companies/${firstCompany.id}/ratings` : '/companies'
    })
  }

  if (negative24h.length > 0) {
    attentionItems.push({
      title: 'Новый негатив за сутки',
      description: `За последние 24 часа найдено ${negative24h.length} негативных сигналов.`,
      meta: negative24h.length >= 3 ? 'Высокий' : 'Средний',
      tone: negative24h.length >= 3 ? 'red' : 'amber',
      href: firstCompany ? `/companies/${firstCompany.id}/inbox?sentiment=NEGATIVE` : '/companies'
    })
  } else if (negative7d.length > previousNegative7d.length && negative7d.length >= 3) {
    attentionItems.push({
      title: 'Негатив растёт',
      description: `За 7 дней негативных сигналов стало больше: ${negative7d.length} против ${previousNegative7d.length}.`,
      meta: 'Средний',
      tone: 'amber',
      href: firstCompany ? `/companies/${firstCompany.id}/inbox?sentiment=NEGATIVE` : '/companies'
    })
  }

  if (lowRating24h.length > 0) {
    attentionItems.push({
      title: 'Появились низкие оценки',
      description: `${lowRating24h.length} новых отзывов имеют рейтинг 1–2★ и требуют реакции.`,
      meta: 'Высокий',
      tone: 'red',
      href: firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'
    })
  }

  if (web24h.length >= 5 || web7d.length >= 20) {
    attentionItems.push({
      title: 'Активность во внешней сети',
      description: `WEB-упоминаний: ${web24h.length} за сутки и ${web7d.length} за 7 дней.`,
      meta: web24h.length >= 10 ? 'Средний' : 'Низкий',
      tone: web24h.length >= 10 ? 'amber' : 'emerald',
      href: firstCompany ? `/companies/${firstCompany.id}/web` : '/companies'
    })
  }

  if (newUnprocessed24h.length >= 5) {
    attentionItems.push({
      title: 'Новые сигналы без обработки',
      description: `${newUnprocessed24h.length} новых упоминаний ещё не переведены в обработанные.`,
      meta: 'Средний',
      tone: 'amber',
      href: firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'
    })
  }

  if (unrated24h.length >= 5 && attentionItems.length < 4) {
    attentionItems.push({
      title: 'Упоминания без оценки',
      description: `${unrated24h.length} свежих сигналов требуют ручной проверки тональности.`,
      meta: 'Низкий',
      tone: 'emerald',
      href: firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'
    })
  }

  if (recent24h.length === 0 && totalSources > 0) {
    attentionItems.push({
      title: 'Нет новых сигналов за сутки',
      description: 'Источники подключены, но за последние 24 часа новых упоминаний не было.',
      meta: 'Низкий',
      tone: 'emerald',
      href: firstCompany ? `/companies/${firstCompany.id}` : '/companies'
    })
  }

  if (attentionItems.length === 0) {
    attentionItems.push({
      title: 'Критичных сигналов нет',
      description: 'Негатив, падение рейтинга и резкие всплески не обнаружены.',
      meta: 'Низкий',
      tone: 'emerald',
      href: firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'
    })
  }

  attentionItems.sort((a, b) => {
    const priority = { Высокий: 3, Средний: 2, Низкий: 1 } as Record<string, number>
    return (priority[b.meta] || 0) - (priority[a.meta] || 0)
  })

  const dayRisk = attentionItems[0]?.meta || 'Низкий'
  const dayRiskTone =
    dayRisk === 'Высокий'
      ? 'border-red-400/25 bg-red-500/10 text-red-200'
      : dayRisk === 'Средний'
        ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
        : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'

  const dayNegativeCount = recent24h.filter((mention) => getMentionSentiment(mention) === 'NEGATIVE').length
  const ratingDelta =
    current7dRating !== null && previous7dRating !== null
      ? current7dRating - previous7dRating
      : null
  const ratingDeltaLabel =
    ratingDelta === null ? '—' : `${ratingDelta >= 0 ? '+' : ''}${ratingDelta.toFixed(1)}`

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -top-10 left-0 right-0 h-44 bg-[radial-gradient(circle_at_28%_0%,rgba(34,211,238,0.28),transparent_42%)]" />

      <div className="relative mb-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-300">Workspace</div>
        <div className="mt-1 text-sm font-semibold text-white">Reputation OS</div>

        <div className="mt-9">
          <h1 className="text-[42px] font-semibold leading-none tracking-[-0.055em] text-white md:text-[52px]">
            Панель управления
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Репутация, отзывы, упоминания и активность источников.
          </p>
        </div>
      </div>

      <Card className="relative mb-5 overflow-hidden rounded-[30px] border-white/10 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.16),transparent_34%),#0b111c]/95 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_44px_rgba(34,211,238,0.06)] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Итог дня</div>
            <div className="mt-1 text-sm text-slate-400">Короткая сводка по новым репутационным сигналам.</div>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${dayRiskTone}`}>
            Риск: {dayRisk.toLowerCase()}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <AlertTriangle className="h-4 w-4 text-amber-200" />
              Риск
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{dayRisk}</div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <MessageSquareText className="h-4 w-4 text-red-200" />
              Новых негативных
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{formatNumber(dayNegativeCount)}</div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Star className="h-4 w-4 text-amber-200" />
              Рейтинг
            </div>
            <div className={ratingDelta !== null && ratingDelta < 0 ? 'mt-2 text-2xl font-semibold text-red-200' : 'mt-2 text-2xl font-semibold text-emerald-200'}>
              {ratingDeltaLabel}
            </div>
          </div>
        </div>
      </Card>

      <div className="relative grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          Icon={BriefcaseBusiness}
          label="Компании"
          value={formatNumber(totalCompanies)}
          hint={totalCompanies > 0 ? 'Без изменений' : 'Добавьте первую'}
          tone="cyan"
        />
        <KpiCard
          Icon={Radar}
          label="Источники"
          value={formatNumber(totalSources)}
          hint={totalSources > 0 ? `+${totalSources} активных` : 'Не подключены'}
          tone="emerald"
        />
        <KpiCard
          Icon={MessageSquareText}
          label="Упоминания"
          value={formatNumber(totalMentions)}
          hint={totalMentions > 0 ? `+${Math.min(totalMentions, 28)} за период` : 'Пока нет данных'}
          tone="violet"
        />
        <KpiCard
          Icon={Star}
          label="Средний рейтинг"
          value={ratingLabel}
          hint={averageRating !== null ? 'На основе отзывов' : 'Нет оценок'}
          tone="amber"
        />
      </div>

      <div className="mt-5">
        <DashboardCharts
          mentionTrend={mentionTrend}
          ratingTrend={ratingTrend}
          platforms={platforms}
          sentiment={sentimentCounts}
          totalMentions={mentionsInPeriod}
          averageRating={averageRating}
        />
      </div>

      <Card className="mt-6 overflow-hidden rounded-[30px] border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_44px_rgba(34,211,238,0.04)] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                <BellRing className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xl font-semibold tracking-[-0.03em] text-white">Последние упоминания</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">Свежие сигналы из отзывов, карт и внешних источников.</div>
              </div>
            </div>
          </div>

          <Link
            href={firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'}
            className="hidden items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 sm:inline-flex"
          >
            Смотреть все
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {latestMentions.length > 0 ? (
          <div className="space-y-3">
            {latestMentions.map((mention: any) => {
                const sentiment = getMentionSentiment(mention)
                const sourceUrl = getSourceUrl(mention)
                const sourceHostname = getSourceHostname(sourceUrl)
                const faviconUrl = getFaviconUrl(sourceUrl)
                const title = getMentionTitle(mention)
                const sourceLabel = sourceHostname || mention.author || getMentionSourceName(mention)

                return (
                  <Link
                    key={mention.id}
                    href={firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'}
                    className="group grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.025] p-4 transition hover:border-cyan-400/20 hover:bg-cyan-500/[0.04] sm:grid-cols-[52px_1fr_auto] sm:items-center"
                  >
                    <div
                      title={sourceHostname || getPlatformLabel(mention.platform)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xs font-bold text-white shadow-[0_0_22px_rgba(255,255,255,0.04)]"
                    >
                      {faviconUrl ? (
                        <img
                          src={faviconUrl}
                          alt=""
                          width={24}
                          height={24}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-6 w-6 rounded-md"
                        />
                      ) : (
                        <span>{sourceHostname ? sourceHostname.slice(0, 1).toUpperCase() : getPlatformLabel(mention.platform)}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-sm font-semibold text-white">
                          {title}
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/25 transition group-hover:text-cyan-300" />
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-400">
                        <span className="font-medium text-slate-300">{sourceLabel}</span>
                        {mention.content ? ` · ${truncate(mention.content, 120)}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${sentimentTone(sentiment)}`}>
                        {sentimentLabel(sentiment)}
                      </span>
                      <span className="text-xs text-slate-500">{formatShortDate(mention.publishedAt)}</span>
                    </div>
                  </Link>
                )
              })}
          </div>
        ) : (
          <EmptyState
            title="Пока нет свежих сигналов"
            description="После синхронизации источников здесь появятся последние отзывы, WEB-упоминания и комментарии."
          />
        )}
      </Card>

        <Card className="mt-6 overflow-hidden rounded-[30px] border-white/10 bg-[radial-gradient(circle_at_0%_0%,rgba(251,191,36,0.10),transparent_34%),#0b111c] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_38px_rgba(251,191,36,0.05)] sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/10 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.10)]">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xl font-semibold tracking-[-0.03em] text-white">Что требует внимания</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">Живые сигналы, риски и проверки по мониторингу.</div>
              </div>
            </div>

            <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300 sm:inline-flex">
              {attentionItems.length} события
            </span>
          </div>

          <div className="space-y-3">
            {attentionItems.map((item) => {
              const isHigh = item.meta === 'Высокий'
              const isMedium = item.meta === 'Средний'
              const isRisk = item.tone === 'red' || item.tone === 'amber'
              const Icon = isRisk ? AlertTriangle : ShieldCheck

              const shellClass = isHigh
                ? 'border-red-400/20 bg-red-500/[0.055] shadow-[inset_3px_0_0_rgba(248,113,113,0.70),0_0_34px_rgba(248,113,113,0.06)] hover:border-red-300/30'
                : isMedium
                  ? 'border-amber-400/20 bg-amber-500/[0.055] shadow-[inset_3px_0_0_rgba(251,191,36,0.70),0_0_34px_rgba(251,191,36,0.05)] hover:border-amber-300/30'
                  : 'border-emerald-400/20 bg-emerald-500/[0.055] shadow-[inset_3px_0_0_rgba(52,211,153,0.70),0_0_34px_rgba(52,211,153,0.05)] hover:border-emerald-300/30'

              const iconClass = isHigh
                ? 'border-red-400/25 bg-red-500/10 text-red-200'
                : isMedium
                  ? 'border-amber-400/25 bg-amber-500/10 text-amber-200'
                  : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'

              const badgeClass = isHigh
                ? 'border-red-400/25 bg-red-500/10 text-red-100'
                : isMedium
                  ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
                  : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`group block rounded-[24px] border p-4 transition hover:bg-white/[0.045] ${shellClass}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${iconClass}`}>
                      <Icon className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                          <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-400">{item.description}</div>
                        </div>

                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                          Приоритет: {item.meta}
                        </span>
                        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-medium text-slate-400">
                          Сегодня
                        </span>
                        <span className="inline-flex rounded-full border border-cyan-400/15 bg-cyan-500/[0.06] px-3 py-1 text-xs font-medium text-cyan-100">
                          Открыть проверку
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>

      <Card className="mt-6 overflow-hidden rounded-[30px] border-white/10 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.10),transparent_35%),#0b111c] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold tracking-[-0.03em] text-white">Быстрые действия</div>
            <div className="mt-1 text-sm leading-6 text-slate-400">Самые частые переходы для ежедневной работы.</div>
          </div>
          <Clock3 className="hidden h-5 w-5 text-cyan-300/70 sm:block" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href={firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'}
            className="group flex min-h-20 items-center justify-between rounded-[24px] border border-cyan-400/20 bg-cyan-500/10 px-5 text-sm font-semibold text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.08)] transition hover:bg-cyan-500/20"
          >
            <span className="inline-flex items-center gap-3">
              <Inbox className="h-5 w-5" />
              Открыть Inbox
            </span>
            <ArrowRight className="h-4 w-4 opacity-45 transition group-hover:opacity-100" />
          </Link>

          <Link
            href="/companies#add-company"
            className="group flex min-h-20 items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <span className="inline-flex items-center gap-3">
              <Plus className="h-5 w-5" />
              Добавить компанию
            </span>
            <ArrowRight className="h-4 w-4 opacity-45 transition group-hover:opacity-100" />
          </Link>

          <Link
            href="/settings"
            className="group flex min-h-20 items-center justify-between rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 px-5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
          >
            <span className="inline-flex items-center gap-3">
              <BellRing className="h-5 w-5" />
              Настроить оповещения
            </span>
            <ArrowRight className="h-4 w-4 opacity-45 transition group-hover:opacity-100" />
          </Link>
        </div>
      </Card>

      {companies.length > 0 ? (
        <Card className="mt-6 overflow-hidden rounded-[30px] border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-200">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xl font-semibold tracking-[-0.03em] text-white">Компании под наблюдением</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">Активные карточки с быстрым переходом в управление.</div>
            </div>
          </div>

          <div className="space-y-3">
            {companies.slice(0, 4).map((company) => (
              <div key={company.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/20 hover:bg-cyan-500/[0.035]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white text-sm font-bold text-slate-950 shadow-[0_0_22px_rgba(255,255,255,0.08)]">
                        {company.logoUrl ? (
                          <img
                            src={company.logoUrl}
                            alt={company.name || 'Логотип компании'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          String(company.name || 'R').trim().slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-white">{company.name || 'Без названия'}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(company)}`}>
                            {getCompanyStatus(company)}
                          </span>
                          {getPlatformList(company).slice(0, 3).map((platform) => (
                            <span key={`${company.id}-${platform}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400">
                              {platform}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Link
                      href={`/companies/${company.id}`}
                      className="inline-flex items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                    >
                      Карточка
                    </Link>
                    <Link
                      href={`/companies/${company.id}/inbox`}
                      className="inline-flex items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                    >
                      Inbox
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
