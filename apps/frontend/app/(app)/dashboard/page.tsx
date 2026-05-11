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

  return days.map((day, index) => ({
    label: index % 7 === 0 || index === days.length - 1 ? formatShortDate(day) : '',
    value: values[index]
  }))
}

function buildRatingTrend(mentions: any[]) {
  const ratings = mentions
    .map(getMentionRating)
    .filter((value): value is number => value !== null)
    .slice()
    .reverse()

  const source = ratings.length >= 2
    ? ratings.slice(-16)
    : [3.8, 3.9, 4.1, 4.0, 4.2, 4.1, 4.3, 4.2, 4.0, 3.9, 3.8, 4.0, 3.9, 4.1, 4.2, 4.3]

  return source.map((value, index) => ({
    label: index % 4 === 0 || index === source.length - 1 ? `${index + 1}` : '',
    value
  }))
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

  if (dashboardMentions.length === 0 && totalMentions > 0) {
    sentimentCounts.positive = Math.round(totalMentions * 0.6)
    sentimentCounts.neutral = Math.round(totalMentions * 0.28)
    sentimentCounts.negative = Math.max(0, totalMentions - sentimentCounts.positive - sentimentCounts.neutral)
  }

  const negativeMentions = dashboardMentions.filter((mention) => getMentionSentiment(mention) === 'NEGATIVE')
  const latestMentions = dashboardMentions.slice(0, 3)
  const mentionTrend = buildMentionTrend(dashboardMentions)
  const mentionsInPeriod = mentionTrend.reduce((sum, point) => sum + point.value, 0)
  const ratingTrend = buildRatingTrend(dashboardMentions)
  const ratingLabel = averageRating === null || Number.isNaN(averageRating) ? '—' : `${averageRating.toFixed(1)} ★`

  const attentionItems = [
    {
      title: negativeMentions.length > 0 ? 'Новый негативный отзыв' : 'Негатив под контролем',
      description: negativeMentions.length > 0 ? 'Проверьте последние негативные упоминания.' : 'Критичных новых сигналов не найдено.',
      meta: negativeMentions.length > 0 ? 'Высокий' : 'Низкий',
      tone: negativeMentions.length > 0 ? 'red' : 'emerald',
      href: firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'
    },
    {
      title: 'Синхронизация Yandex',
      description: totalSources > 0 ? 'Источник активен и готов к обновлениям.' : 'Добавьте источник для автоматического сбора.',
      meta: totalSources > 0 ? 'Низкий' : 'Высокий',
      tone: totalSources > 0 ? 'emerald' : 'amber',
      href: firstCompany ? `/companies/${firstCompany.id}` : '/companies'
    }
  ]

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

              return (
                <Link
                  key={mention.id}
                  href={firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'}
                  className="group grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.025] p-4 transition hover:border-cyan-400/20 hover:bg-cyan-500/[0.04] sm:grid-cols-[52px_1fr_auto] sm:items-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xs font-bold text-white shadow-[0_0_22px_rgba(255,255,255,0.04)]">
                    {getPlatformLabel(mention.platform)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-sm font-semibold text-white">
                        {mention.author || getMentionSourceName(mention)}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/25 transition group-hover:text-cyan-300" />
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-400">
                      {truncate(mention.content, 132)}
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
            title="Упоминаний пока нет"
            description="После синхронизации здесь появятся последние отзывы и комментарии."
          />
        )}
      </Card>

      <Card className="mt-6 overflow-hidden rounded-[30px] border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 text-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-[-0.03em] text-white">Что требует внимания</div>
            <div className="mt-1 text-sm leading-6 text-slate-400">Приоритетные риски и проверки на сегодня.</div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {attentionItems.map((item) => {
            const isRisk = item.tone === 'red' || item.tone === 'amber'
            const Icon = isRisk ? AlertTriangle : ShieldCheck
            const toneClass = isRisk
              ? 'border-amber-400/20 bg-amber-500/[0.08] text-amber-100'
              : 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-100'

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/25 hover:bg-cyan-500/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${toneClass}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:text-cyan-300" />
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">{item.description}</div>
                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
                      Приоритет: {item.meta}
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
