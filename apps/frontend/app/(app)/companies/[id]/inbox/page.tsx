import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import InboxMentionsList from '@/components/inbox/InboxMentionsList'
import { getCompanyMentions } from '@/lib/api/mentions'
import { getCompany } from '@/lib/api/companies'

export default async function CompanyInboxPage({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams?: {
    platform?: string
    sentiment?: string
    rating?: string
    from?: string
    to?: string
  }
}) {
  let response: any = { data: [], meta: { total: 0, page: 1, limit: 20 } }
  let company: any = null
  let authRequired = false

  const initialRating = Number(searchParams?.rating || 0)
  const initialFilters = {
    platform: searchParams?.platform || '',
    sentiment: searchParams?.sentiment || '',
    rating: [1, 2, 3, 4, 5].includes(initialRating) ? initialRating : null,
    from: searchParams?.from || '',
    to: searchParams?.to || ''
  }

  const initialQuery = new URLSearchParams()
  initialQuery.set('page', '1')
  initialQuery.set('limit', '20')
  if (initialFilters.platform) initialQuery.set('platform', initialFilters.platform)
  if (initialFilters.sentiment) initialQuery.set('sentiment', initialFilters.sentiment)
  if (initialFilters.rating) initialQuery.set('rating', String(initialFilters.rating))
  if (initialFilters.from) initialQuery.set('from', initialFilters.from)
  if (initialFilters.to) initialQuery.set('to', initialFilters.to)

  try {
    const [mentionsResponse, companyResponse] = await Promise.all([
      getCompanyMentions(params.id, `?${initialQuery.toString()}`),
      getCompany(params.id)
    ])

    response = mentionsResponse
    company = companyResponse
  } catch {
    authRequired = true
  }

  const mentions = Array.isArray(response?.data) ? response.data : []
  const total = Number(response?.meta?.total || 0)
  const averageRating = response?.meta?.averageRating === null || response?.meta?.averageRating === undefined
    ? null
    : Number(response.meta.averageRating)
  const ratedCount = Number(response?.meta?.ratedCount || 0)

  const yandexTarget = Array.isArray(company?.sourceTargets)
    ? company.sourceTargets.find((target: any) => target?.source?.platform === 'YANDEX')
    : null

  const isAwaitingInitialYandexData =
    Boolean(yandexTarget) &&
    Boolean(yandexTarget?.syncReviewsEnabled) &&
    mentions.length === 0 &&
    total === 0

  return (
    <div>
      <PageHeader
        title="Входящие"
        subtitle="Отзывы, упоминания, посты VK и комментарии VK в одной очереди."
      />

      {authRequired ? (
        <EmptyState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить живые упоминания из API."
        />
      ) : (
        <InboxMentionsList
          companyId={params.id}
          initialMentions={mentions}
          total={total}
          initialAverageRating={averageRating}
          initialRatedCount={ratedCount}
          isAwaitingInitialYandexData={isAwaitingInitialYandexData}
          initialFilters={initialFilters}
        />
      )}

    </div>
  )
}
