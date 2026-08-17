import PageState from '@/components/ui/PageState'
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'
import SubscriptionGate from '@/components/billing/SubscriptionGate'
import { getAnalyticsOverview, getAnalyticsSentiment, getAnalyticsPlatforms } from '@/lib/api/analytics'
import { isApiError } from '@/lib/api/client'

export default async function CompanyAnalyticsPage({ params, searchParams }: { params: { id: string }, searchParams?: { from?: string, to?: string } }) {
  let overview: any = null
  let sentiment: any[] = []
  let platforms: any = null
  let authRequired = false

  try {
    const query = searchParams?.from && searchParams?.to ? `?from=${searchParams.from}&to=${searchParams.to}` : ''

    overview = await getAnalyticsOverview(params.id, query)

    try {
      ;[sentiment, platforms] = await Promise.all([
        getAnalyticsSentiment(params.id, query),
        getAnalyticsPlatforms(params.id, query)
      ])
    } catch (error) {
      if (!isApiError(error, 403)) throw error
    }
  } catch (error) {
    if (isApiError(error, 401)) authRequired = true
    else throw error
  }

  return (
    <div>
      {authRequired ? (
        <PageState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить аналитику из API."
        />
      ) : (
        <SubscriptionGate feature="ADVANCED_ANALYTICS">
          <AnalyticsDashboard
            overview={overview}
            sentiment={sentiment}
            platforms={platforms}
          />
        </SubscriptionGate>
      )}
    </div>
  )
}
