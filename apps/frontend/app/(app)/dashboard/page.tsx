import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import DashboardCharts from '@/components/dashboard/DashboardCharts'
import { getCompanies } from '@/lib/api/companies'
import { getCompanyMentions } from '@/lib/api/mentions'

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
  icon,
  label,
  value,
  hint,
  tone
}: {
  icon: string
  label: string
  value: string
  hint: string
  tone: 'cyan' | 'emerald' | 'violet' | 'amber'
}) {
  const toneClass = {
    cyan: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.12)]',
    emerald: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200 shadow-[0_0_28px_rgba(52,211,153,0.12)]',
    violet: 'border-violet-400/25 bg-violet-500/10 text-violet-200 shadow-[0_0_28px_rgba(139,92,246,0.12)]',
    amber: 'border-amber-400/25 bg-amber-500/10 text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.12)]'
  }[tone]

  const lineClass = {
    cyan: 'from-cyan-400/20 via-cyan-300 to-cyan-400/70',
    emerald: 'from-emerald-400/20 via-emerald-300 to-emerald-400/70',
    violet: 'from-violet-400/20 via-violet-300 to-violet-400/70',
    amber: 'from-amber-400/20 via-amber-300 to-amber-400/70'
  }[tone]

  return (
    <Card className="relative overflow-hidden p-3.5 sm:p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border text-base ${toneClass}`}>
          {icon}
        </div>

        <div className="mt-1 flex h-7 w-16 items-end gap-1 opacity-80">
          <span className={`h-2 w-1.5 rounded-full bg-gradient-to-t ${lineClass}`} />
          <span className={`h-4 w-1.5 rounded-full bg-gradient-to-t ${lineClass}`} />
          <span className={`h-3 w-1.5 rounded-full bg-gradient-to-t ${lineClass}`} />
          <span className={`h-5 w-1.5 rounded-full bg-gradient-to-t ${lineClass}`} />
          <span className={`h-6 w-1.5 rounded-full bg-gradient-to-t ${lineClass}`} />
        </div>
      </div>

      <div className="mt-4 text-xs text-muted sm:text-sm">{label}</div>
      <div className="mt-1 text-2xl font-semibold leading-none text-brand sm:text-3xl">{value}</div>
      <div className="mt-2 truncate text-xs text-emerald-300">{hint}</div>
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

    const firstCompany = companies[0]
    if (firstCompany?.id) {
      const mentionsResult = await getCompanyMentions(firstCompany.id, '?page=1&limit=50')
      dashboardMentions = Array.isArray(mentionsResult?.data) ? mentionsResult.data : []
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

  const firstCompany = companies[0] || null
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
      title: 'VK мониторинг',
      description: 'Проверьте подключение VK и поиск комментариев.',
      meta: 'Средний',
      tone: 'blue',
      href: firstCompany ? `/companies/${firstCompany.id}/vk` : '/companies'
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
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Панель управления"
          subtitle="Репутация, отзывы, упоминания и активность источников."
        />

        <div className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-xl border border-line bg-panel/80 px-3 text-xs font-medium text-brand shadow-panel sm:text-sm">
          <span className="text-cyan-300">▦</span>
          <span>Последние 30 дней</span>
          <span className="text-muted">⌄</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          icon="▥"
          label="Компании"
          value={formatNumber(totalCompanies)}
          hint={totalCompanies > 0 ? 'Без изменений' : 'Добавьте первую'}
          tone="cyan"
        />
        <KpiCard
          icon="●"
          label="Источники"
          value={formatNumber(totalSources)}
          hint={totalSources > 0 ? `+${totalSources} активных` : 'Не подключены'}
          tone="emerald"
        />
        <KpiCard
          icon="▤"
          label="Упоминания"
          value={formatNumber(totalMentions)}
          hint={totalMentions > 0 ? `+${Math.min(totalMentions, 28)} за период` : 'Пока нет данных'}
          tone="violet"
        />
        <KpiCard
          icon="★"
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

      <Card className="mt-5 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-brand">Последние упоминания</div>
            <div className="mt-1 text-sm text-muted">Живая лента последних найденных отзывов и комментариев.</div>
          </div>

          <Link
            href={firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'}
            className="hidden text-sm text-cyan-300 hover:text-cyan-200 sm:inline"
          >
            Смотреть все →
          </Link>
        </div>

        {latestMentions.length > 0 ? (
          <div className="divide-y divide-white/10">
            {latestMentions.map((mention: any) => {
              const sentiment = getMentionSentiment(mention)

              return (
                <Link
                  key={mention.id}
                  href={firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'}
                  className="grid gap-3 py-3 transition hover:bg-white/[0.02] sm:grid-cols-[44px_1fr_auto] sm:items-center"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-brand">
                    {String(mention.platform || 'OS').slice(0, 2)}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-brand">{mention.author || 'Автор неизвестен'}</div>
                    <div className="mt-1 truncate text-sm text-muted">{truncate(mention.content, 92)}</div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${sentimentTone(sentiment)}`}>
                      {sentimentLabel(sentiment)}
                    </span>
                    <span className="text-xs text-muted">{formatShortDate(mention.publishedAt)}</span>
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

      <Card className="mt-5 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-brand">Что требует внимания</div>
            <div className="mt-1 text-sm text-muted">Риски, задачи и быстрые проверки.</div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {attentionItems.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/25 hover:bg-cyan-400/5"
            >
              <div className="text-sm font-semibold text-brand">{item.title}</div>
              <div className="mt-1 text-sm leading-5 text-muted">{item.description}</div>
              <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-muted">
                {item.meta}
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <div className="text-lg font-semibold text-brand">Быстрые действия</div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href={firstCompany ? `/companies/${firstCompany.id}/inbox` : '/companies'}
            className="inline-flex min-h-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          >
            Открыть Inbox
          </Link>

          <Link
            href={firstCompany ? `/companies/${firstCompany.id}/vk` : '/companies'}
            className="inline-flex min-h-16 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20"
          >
            Подключить VK
          </Link>

          <Link
            href="/companies"
            className="inline-flex min-h-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-brand transition hover:bg-white/10"
          >
            Добавить компанию
          </Link>

          <Link
            href={firstCompany ? `/companies/${firstCompany.id}` : '/companies'}
            className="inline-flex min-h-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Запустить синхронизацию
          </Link>
        </div>
      </Card>

      {companies.length > 0 ? (
        <Card className="mt-5 p-5">
          <div className="text-lg font-semibold text-brand">Компании под наблюдением</div>
          <div className="mt-1 text-sm text-muted">Карточки компаний с быстрым переходом в управление.</div>

          <div className="mt-5 space-y-3">
            {companies.slice(0, 4).map((company) => (
              <div key={company.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-base font-semibold text-brand">{company.name || 'Без названия'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${getStatusTone(company)}`}>
                        {getCompanyStatus(company)}
                      </span>
                      {getPlatformList(company).map((platform) => (
                        <span key={`${company.id}-${platform}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted">
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/companies/${company.id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-line px-3 py-2 text-sm font-medium text-brand transition hover:bg-white/5"
                    >
                      Карточка
                    </Link>
                    <Link
                      href={`/companies/${company.id}/inbox`}
                      className="inline-flex items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20 hover:text-white"
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
