import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Card from '@/components/ui/Card'
import CompanyYandexCronToggle from '@/components/companies/CompanyYandexCronToggle'
import CompanyEditPopup from '@/components/companies/CompanyEditPopup'
import CompanySyncStatusCard from '@/components/companies/CompanySyncStatusCard'
import CompanyManualSyncButton from '@/components/companies/CompanyManualSyncButton'
import { getCompany, getCompanySyncStatus } from '@/lib/api/companies'
import { getCompanyMentions } from '@/lib/api/mentions'

function formatShortDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU')
}

function getRatingLabel(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)} ★`
}

function getMentionEffectiveSentiment(mention: any) {
  const rating =
    mention?.ratingValue !== null && mention?.ratingValue !== undefined
      ? Number(mention.ratingValue)
      : null

  if (rating !== null && Number.isFinite(rating)) {
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
  return value
}

function sentimentClass(value: string) {
  if (value === 'POSITIVE') return 'border-emerald-400/30 bg-blue-500/15 text-emerald-200'
  if (value === 'NEGATIVE') return 'border-red-400/30 bg-red-500/15 text-red-200'
  if (value === 'NEUTRAL') return 'border-amber-400/30 bg-amber-500/15 text-amber-100'
  return 'border-white/10 bg-white/10 text-brand'
}

function truncate(value: string, limit = 110) {
  if (!value) return ''
  if (value.length <= limit) return value
  return `${value.slice(0, limit).trim()}…`
}

export default async function CompanyPage({ params }: { params: { id: string } }) {
  let company: any = null
  let mentionsResponse: any = { data: [], meta: { total: 0, averageRating: null, ratedCount: 0 } }
  let latestMentionsResponse: any = { data: [], meta: { total: 0 } }
  let negativeResponse: any = { data: [], meta: { total: 0 } }
  let recentNegativeResponse: any = { data: [], meta: { total: 0 } }
  let syncStatus: any = null
  let authRequired = false

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoParam = sevenDaysAgo.toISOString().slice(0, 10)

  try {
    const [companyData, mentionsData, latestData, negativeData, recentNegativeData, syncStatusData] = await Promise.all([
      getCompany(params.id),
      getCompanyMentions(params.id, '?page=1&limit=1'),
      getCompanyMentions(params.id, '?page=1&limit=3'),
      getCompanyMentions(params.id, '?page=1&limit=1&sentiment=NEGATIVE'),
      getCompanyMentions(params.id, `?page=1&limit=1&sentiment=NEGATIVE&from=${sevenDaysAgoParam}`),
      getCompanySyncStatus(params.id)
    ])

    company = companyData
    mentionsResponse = mentionsData
    latestMentionsResponse = latestData
    negativeResponse = negativeData
    recentNegativeResponse = recentNegativeData
    syncStatus = syncStatusData
  } catch {
    authRequired = true
  }

  if (authRequired) {
    return (
      <div>
        <PageHeader title="Компания" subtitle="Загрузка данных компании." />
        <EmptyState title="Требуется авторизация" description="Войдите в систему, чтобы открыть карточку компании." />
      </div>
    )
  }

  if (!company) {
    return (
      <div>
        <PageHeader title="Компания" subtitle="Загрузка данных компании." />
        <EmptyState title="Компания не найдена" description="Не удалось загрузить запрошенную компанию." />
      </div>
    )
  }

  const mentionsTotal = Number(mentionsResponse?.meta?.total || company._count?.mentions || 0)
  const averageRatingRaw = mentionsResponse?.meta?.averageRating
  const averageRating = averageRatingRaw === null || averageRatingRaw === undefined ? null : Number(averageRatingRaw)
  const ratedCount = Number(mentionsResponse?.meta?.ratedCount || 0)
  const negativeTotal = Number(negativeResponse?.meta?.total || 0)
  const recentNegativeTotal = Number(recentNegativeResponse?.meta?.total || 0)
  const lastNegative = Array.isArray(negativeResponse?.data) ? negativeResponse.data[0] : null
  const latestMentions = Array.isArray(latestMentionsResponse?.data) ? latestMentionsResponse.data.slice(0, 3) : []

  const yandexTarget = Array.isArray(company.sourceTargets)
    ? company.sourceTargets.find((target: any) => target?.source?.platform === 'YANDEX')
    : null
  const twoGisTarget = Array.isArray(company.sourceTargets)
    ? company.sourceTargets.find((target: any) => target?.source?.platform === 'TWOGIS')
    : null

  const hasYandex = Boolean(yandexTarget?.externalUrl)
  const hasTwoGis = Boolean(twoGisTarget?.externalUrl)
  const connectedSources = [hasYandex, hasTwoGis].filter(Boolean).length
  const companyWebsite = company.website || ''
  const primarySourceUrl = yandexTarget?.externalUrl || ''
  const twoGisSourceUrl = twoGisTarget?.externalUrl || ''

  return (
    <div className="space-y-4 pb-28">
      <CompanyEditPopup company={company} yandexUrl={primarySourceUrl} twoGisUrl={twoGisSourceUrl} />

        <Card className="overflow-hidden border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-5 shadow-[0_0_48px_rgba(59,130,246,0.12)]">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-violet-400/40 bg-cyan-400/10 text-2xl font-semibold text-blue-100 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt={company.name || "Логотип компании"} className="h-full w-full object-cover" />
                  ) : (
                    String(company.name || "R").trim().slice(0, 1).toUpperCase()
                  )}
                </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-violet-400/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">live мониторинг</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">{connectedSources || 0} источника</span>
                </div>

                <div className="mt-3 truncate text-2xl font-semibold text-brand">{company.name || 'Карточка компании'}</div>
                <div className="mt-1 text-sm leading-6 text-zinc-300">Сводка по отзывам, упоминаниям и сигналам, которые требуют внимания.</div>
              </div>
            </div>

            <div className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/10 bg-black/15">
              <div className="p-4">
                <div className="text-2xl font-semibold text-blue-100">{mentionsTotal}</div>
                <div className="mt-1 text-xs text-zinc-300">упоминаний</div>
              </div>
              <div className="border-l border-white/10 p-4">
                <div className="text-2xl font-semibold text-emerald-100">{getRatingLabel(averageRating)}</div>
                <div className="mt-1 text-xs text-zinc-300">{ratedCount} с оценкой</div>
              </div>
              <div className="border-l border-white/10 p-4">
                <div className="text-2xl font-semibold text-red-100">{negativeTotal}</div>
                <div className="mt-1 text-xs text-zinc-300">внимания</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-3xl border border-red-400/15 bg-red-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-red-100">{recentNegativeTotal} новых негативных сигналов за 7 дней</div>
                <div className="mt-1 text-xs text-zinc-300">Последний негатив: {formatShortDate(lastNegative?.publishedAt)}</div>
              </div>

              <Link href={`/companies/${company.id}/inbox?sentiment=NEGATIVE`} className="group relative inline-flex h-16 w-full items-center justify-center overflow-hidden rounded-[28px] border border-red-400/25 bg-red-500/10 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/20">
                Открыть Inbox →
              </Link>
            </div>
          </div>
        </Card>

        <CompanySyncStatusCard status={syncStatus} />

        <Card className="mt-6 border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xl font-semibold tracking-[-0.035em] text-white">Ручное обновление</div>
              <div className="mt-2 text-sm leading-6 text-zinc-300">
                Запустит сбор упоминаний, отзывов и рейтинга по подключенным источникам.
              </div>
            </div>

            <CompanyManualSyncButton companyId={company.id} />
          </div>
        </Card>

      <Card className="mt-6 border-orange-400/20 bg-orange-500/10/10 shadow-[0_0_34px_rgba(251,146,60,0.10)]/[0.04] p-5 shadow-[0_0_40px_rgba(249,115,22,0.08)]">
        <div className="mb-4 text-lg font-semibold text-brand">⚠ Что требует внимания</div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center">
          <div>
            <div className="text-2xl font-semibold text-orange-200">{negativeTotal}</div>
            <div className="text-sm text-zinc-300">негативных отзывов</div>
          </div>

          <div>
            <div className="text-2xl font-semibold text-orange-200">{recentNegativeTotal}</div>
            <div className="text-sm text-zinc-300">новых за последние 7 дней</div>
          </div>

          <div>
            <div className="text-2xl font-semibold text-orange-200">{formatShortDate(lastNegative?.publishedAt)}</div>
            <div className="text-sm text-zinc-300">последний негатив</div>
          </div>

          <Link
            href={`/companies/${company.id}/inbox?sentiment=NEGATIVE`}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-orange-500/10/10 shadow-[0_0_34px_rgba(251,146,60,0.10)] px-4 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Открыть негативные в Inbox
          </Link>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-4 text-lg font-semibold text-brand">Источники мониторинга</div>

        <div className="space-y-3">
          <div className="group relative overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.14),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_36px_rgba(34,211,238,0.055)] transition hover:border-blue-300/30 hover:bg-cyan-400/[0.045] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-white">Yandex Maps</div>
                  <span
                    className={
                      hasYandex
                        ? 'rounded-full border border-violet-400/40 bg-blue-500/10 px-2 py-0.5 text-xs text-emerald-200'
                        : 'rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-300'
                    }
                  >
                    {hasYandex ? 'Подключено' : 'Не подключено'}
                  </span>
                </div>

                <div className="mt-2 text-sm leading-6 text-slate-400">
                  {mentionsTotal} отзывов · автообновление каждые 10 минут
                </div>

                {primarySourceUrl ? (
                  <a
                    href={primarySourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block truncate text-sm break-all text-sm font-medium text-blue-100/90 transition hover:text-blue-100 hover:text-blue-100"
                  >
                    {primarySourceUrl}
                  </a>
                ) : (
                  <div className="mt-2 text-sm text-zinc-300">Добавьте ссылку на Яндекс Карты в данных компании.</div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {primarySourceUrl ? (
                  <a
                    href={primarySourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative inline-flex h-16 w-full items-center justify-center overflow-hidden rounded-[28px] border border-white/10 px-3 text-sm text-brand transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
                  >
                    Открыть источник ↗
                  </a>
                ) : null}

                {yandexTarget ? (
                  <CompanyYandexCronToggle
                    companyId={company.id}
                    targetId={yandexTarget.id}
                    initialEnabled={Boolean(yandexTarget.syncReviewsEnabled)}
                  />
                ) : null}
              </div>
            </div>
          </div>

            <div className="group relative overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.14),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_36px_rgba(34,211,238,0.055)] transition hover:border-blue-300/30 hover:bg-cyan-400/[0.045] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-white">2GIS</div>
                    <span
                      className={
                        hasTwoGis
                          ? 'rounded-full border border-violet-400/40 bg-blue-500/10 px-2 py-0.5 text-xs text-emerald-200'
                          : 'rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-300'
                      }
                    >
                      {hasTwoGis ? 'Подключено' : 'Не подключено'}
                    </span>
                  </div>

                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    Отзывы 2GIS · автообновление каждые 10 минут
                  </div>

                  {twoGisSourceUrl ? (
                    <a
                      href={twoGisSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block truncate text-sm break-all text-sm font-medium text-blue-100/90 transition hover:text-blue-100 hover:text-blue-100"
                    >
                      {twoGisSourceUrl}
                    </a>
                  ) : (
                    <div className="mt-2 text-sm text-zinc-300">Добавьте ссылку на 2GIS в данных компании.</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {twoGisSourceUrl ? (
                    <a
                      href={twoGisSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative inline-flex h-16 w-full items-center justify-center overflow-hidden rounded-[28px] border border-white/10 px-3 text-sm text-brand transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
                    >
                      Открыть источник ↗
                    </a>
                  ) : null}

                  {twoGisTarget ? (
                    <CompanyYandexCronToggle
                      companyId={company.id}
                      targetId={twoGisTarget.id}
                      initialEnabled={Boolean(twoGisTarget.syncReviewsEnabled)}
                    />
                  ) : null}
                </div>
              </div>
            </div>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-xl font-semibold tracking-[-0.035em] text-white">Данные компании</div>
          <a href="#company-edit" className="text-sm break-all text-sm font-medium text-blue-100/90 transition hover:text-blue-100 hover:text-blue-100">
            Редактировать
          </a>
        </div>

          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <span className="text-zinc-300">Название:</span>
              <span className="text-brand">{company.name || 'Не указано'}</span>
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-3">
              <span className="text-zinc-300">Сайт:</span>
              {companyWebsite ? (
                <a href={companyWebsite} target="_blank" rel="noopener noreferrer" className="truncate break-all text-sm font-medium text-blue-100/90 transition hover:text-blue-100 hover:text-blue-100">
                  {companyWebsite}
                </a>
              ) : (
                <span className="text-zinc-300">Не заполнено</span>
              )}
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-3">
              <span className="text-zinc-300">Город:</span>
              <span className={company.city ? 'text-brand' : 'text-zinc-300'}>{company.city || 'Не заполнено'}</span>
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-3">
              <span className="text-zinc-300">Сфера:</span>
              <span className={company.industry ? 'text-brand' : 'text-zinc-300'}>{company.industry || 'Не заполнено'}</span>
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-3">
              <span className="text-zinc-300">Yandex Maps:</span>
              {primarySourceUrl ? (
                <a href={primarySourceUrl} target="_blank" rel="noopener noreferrer" className="truncate break-all text-sm font-medium text-blue-100/90 transition hover:text-blue-100 hover:text-blue-100">
                  {primarySourceUrl}
                </a>
              ) : (
                <span className="text-zinc-300">Не заполнено</span>
              )}
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-3">
              <span className="text-zinc-300">2GIS:</span>
              {twoGisSourceUrl ? (
                <a href={twoGisSourceUrl} target="_blank" rel="noopener noreferrer" className="truncate break-all text-sm font-medium text-blue-100/90 transition hover:text-blue-100 hover:text-blue-100">
                  {twoGisSourceUrl}
                </a>
              ) : (
                <span className="text-zinc-300">Не заполнено</span>
              )}
            </div>
          </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-xl font-semibold tracking-[-0.035em] text-white">Последние упоминания</div>
          <Link
            href={`/companies/${company.id}/inbox`}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-cyan-400/30 px-3 text-sm break-all text-sm font-medium text-blue-100/90 transition hover:text-blue-100 transition hover:bg-cyan-400/10"
          >
            Открыть Inbox
          </Link>
        </div>

        {latestMentions.length ? (
          <div className="space-y-3">
            {latestMentions.map((mention: any) => {
              const effectiveSentiment = getMentionEffectiveSentiment(mention)
              const rating =
                mention?.ratingValue !== null && mention?.ratingValue !== undefined
                  ? Number(mention.ratingValue)
                  : null

              return (
                <div key={mention.id} className="group relative overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.14),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_36px_rgba(34,211,238,0.055)] transition hover:border-blue-300/30 hover:bg-cyan-400/[0.045] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2 py-0.5 text-xs font-semibold text-yellow-200">
                          {mention.platform}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sentimentClass(effectiveSentiment)}`}>
                          {sentimentLabel(effectiveSentiment)}
                        </span>
                        {rating !== null && Number.isFinite(rating) ? (
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sentimentClass(effectiveSentiment)}`}>
                            ★ {rating}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-brand">“{truncate(mention.content)}”</div>
                    </div>

                    <div className="shrink-0 text-left text-xs text-zinc-300 lg:text-right">
                      <div>{mention.author || 'Автор неизвестен'}</div>
                      <div className="mt-1">{formatShortDate(mention.publishedAt)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState title="Упоминаний пока нет" description="После синхронизации последние отзывы появятся здесь." />
        )}
      </Card>
    </div>
  )
}
