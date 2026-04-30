import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Card from '@/components/ui/Card'
import CompanyYandexCronToggle from '@/components/companies/CompanyYandexCronToggle'
import CompanyEditPanel from '@/components/companies/CompanyEditPanel'
import { getCompany } from '@/lib/api/companies'
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
  if (value === 'POSITIVE') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
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
  let authRequired = false

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoParam = sevenDaysAgo.toISOString().slice(0, 10)

  try {
    const [companyData, mentionsData, latestData, negativeData, recentNegativeData] = await Promise.all([
      getCompany(params.id),
      getCompanyMentions(params.id, '?page=1&limit=1'),
      getCompanyMentions(params.id, '?page=1&limit=3'),
      getCompanyMentions(params.id, '?page=1&limit=1&sentiment=NEGATIVE'),
      getCompanyMentions(params.id, `?page=1&limit=1&sentiment=NEGATIVE&from=${sevenDaysAgoParam}`)
    ])

    company = companyData
    mentionsResponse = mentionsData
    latestMentionsResponse = latestData
    negativeResponse = negativeData
    recentNegativeResponse = recentNegativeData
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

  const hasYandex = Boolean(yandexTarget?.externalUrl)
  const connectedSources = [hasYandex].filter(Boolean).length
  const companyWebsite = company.website || ''
  const primarySourceUrl = yandexTarget?.externalUrl || ''

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title={company.name || 'Карточка компании'}
          subtitle="Обзор компании, источники и действия мониторинга."
        />

        <a
          href="#company-edit"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-brand transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
        >
          ✎ Редактировать компанию
        </a>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="text-lg font-semibold text-brand">Состояние репутации</div>
          <div className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-muted">live</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <div className="text-4xl font-semibold text-cyan-200">{mentionsTotal}</div>
            <div className="mt-1 text-sm text-muted">упоминаний</div>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <div className="text-4xl font-semibold text-emerald-200">{getRatingLabel(averageRating)}</div>
            <div className="mt-1 text-sm text-muted">средний рейтинг</div>
          </div>

          <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
            <div className="text-4xl font-semibold text-blue-200">{ratedCount}</div>
            <div className="mt-1 text-sm text-muted">отзывов с оценкой</div>
          </div>

          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
            <div className="text-4xl font-semibold text-red-200">{negativeTotal}</div>
            <div className="mt-1 text-sm text-muted">требуют внимания</div>
            <div className="mt-2 text-xs text-red-100/70">
              {recentNegativeTotal} новых за 7 дней
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted">
          Репутация отслеживается по {connectedSources || 0} источнику.
        </div>
      </Card>

      <Card className="mt-6 border-orange-400/20 bg-orange-500/[0.04] p-5 shadow-[0_0_40px_rgba(249,115,22,0.08)]">
        <div className="mb-4 text-lg font-semibold text-brand">⚠ Что требует внимания</div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center">
          <div>
            <div className="text-2xl font-semibold text-orange-200">{negativeTotal}</div>
            <div className="text-sm text-muted">негативных отзывов</div>
          </div>

          <div>
            <div className="text-2xl font-semibold text-orange-200">{recentNegativeTotal}</div>
            <div className="text-sm text-muted">новых за последние 7 дней</div>
          </div>

          <div>
            <div className="text-2xl font-semibold text-orange-200">{formatShortDate(lastNegative?.publishedAt)}</div>
            <div className="text-sm text-muted">последний негатив</div>
          </div>

          <Link
            href={`/companies/${company.id}/inbox?sentiment=NEGATIVE`}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Открыть негативные в Inbox
          </Link>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-4 text-lg font-semibold text-brand">Источники мониторинга</div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-brand">Yandex Maps</div>
                  <span
                    className={
                      hasYandex
                        ? 'rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200'
                        : 'rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-muted'
                    }
                  >
                    {hasYandex ? 'Подключено' : 'Не подключено'}
                  </span>
                </div>

                <div className="mt-1 text-sm text-muted">
                  {mentionsTotal} отзывов · автообновление каждые 30 минут
                </div>

                {primarySourceUrl ? (
                  <a
                    href={primarySourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block truncate text-sm text-cyan-300 hover:text-cyan-200"
                  >
                    {primarySourceUrl}
                  </a>
                ) : (
                  <div className="mt-2 text-sm text-muted">Добавьте ссылку на Яндекс Карты в данных компании.</div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {primarySourceUrl ? (
                  <a
                    href={primarySourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-sm text-brand transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
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

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-brand">VK</div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-muted">
                    Не подключено
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted">Подключите VK для отслеживания упоминаний и комментариев.</div>
              </div>

              <Link
                href={`/companies/${company.id}/vk`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-sm text-brand transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
              >
                Подключить VK
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-brand">Данные компании</div>
          <a href="#company-edit" className="text-sm text-cyan-300 hover:text-cyan-200">
            Редактировать
          </a>
        </div>

        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <span className="text-muted">Название:</span>
            <span className="text-brand">{company.name || 'Не указано'}</span>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-3">
            <span className="text-muted">Сайт:</span>
            {companyWebsite ? (
              <a href={companyWebsite} target="_blank" rel="noopener noreferrer" className="truncate text-cyan-300 hover:text-cyan-200">
                {companyWebsite}
              </a>
            ) : (
              <span className="text-muted">Не заполнено</span>
            )}
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-3">
            <span className="text-muted">Город:</span>
            <span className={company.city ? 'text-brand' : 'text-muted'}>{company.city || 'Не заполнено'}</span>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-3">
            <span className="text-muted">Сфера:</span>
            <span className={company.industry ? 'text-brand' : 'text-muted'}>{company.industry || 'Не заполнено'}</span>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-3">
            <span className="text-muted">Основная ссылка:</span>
            {primarySourceUrl ? (
              <a href={primarySourceUrl} target="_blank" rel="noopener noreferrer" className="truncate text-cyan-300 hover:text-cyan-200">
                {primarySourceUrl}
              </a>
            ) : (
              <span className="text-muted">Не заполнено</span>
            )}
          </div>
        </div>

        <CompanyEditPanel company={company} yandexUrl={primarySourceUrl} />
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-brand">Последние упоминания</div>
          <Link
            href={`/companies/${company.id}/inbox`}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-cyan-400/30 px-3 text-sm text-cyan-300 transition hover:bg-cyan-400/10"
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
                <div key={mention.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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

                    <div className="shrink-0 text-left text-xs text-muted lg:text-right">
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
