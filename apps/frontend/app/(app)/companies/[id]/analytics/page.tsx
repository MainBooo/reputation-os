import PageState from '@/components/ui/PageState'
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'
import { getAnalyticsOverview, getAnalyticsSentiment, getAnalyticsPlatforms } from '@/lib/api/analytics'

export default async function CompanyAnalyticsPage({ params, searchParams }: { params: { id: string }, searchParams?: { from?: string, to?: string } }) {
  let overview: any = null
  let sentiment: any[] = []
  let platforms: any = null
  let authRequired = false

  try {
    const query = searchParams?.from && searchParams?.to ? `?from=${searchParams.from}&to=${searchParams.to}` : ''

    overview = await getAnalyticsOverview(params.id, query)
    sentiment = await getAnalyticsSentiment(params.id)
    platforms = await getAnalyticsPlatforms(params.id, query)
  } catch {
    authRequired = true
  }

  return (
    <div>
      {authRequired ? (
        <PageState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить аналитику из API."
        />
      ) : (
        <AnalyticsDashboard
          overview={overview}
          sentiment={sentiment}
          platforms={platforms}
        />
      )}
    </div>
  )
}
