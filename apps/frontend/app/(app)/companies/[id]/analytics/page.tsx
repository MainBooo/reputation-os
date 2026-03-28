import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { getAnalyticsOverview, getAnalyticsSentiment, getAnalyticsPlatforms } from '@/lib/api/analytics'

export default async function CompanyAnalyticsPage({ params }: { params: { id: string } }) {
  let overview: any = null
  let sentiment: any[] = []
  let platforms: any = null
  let authRequired = false

  try {
    overview = await getAnalyticsOverview(params.id)
    sentiment = await getAnalyticsSentiment(params.id)
    platforms = await getAnalyticsPlatforms(params.id)
  } catch {
    authRequired = true
  }

  return (
    <div>
      <PageHeader
        title="Аналитика"
        subtitle="Сводная аналитика по тональности, площадкам и динамике репутации."
      />

      {authRequired ? (
        <EmptyState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить аналитику из API."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Всего упоминаний" value={overview?.mentionsCount || 0} />
            <StatCard label="Негативные упоминания" value={overview?.negativeCount || 0} />
            <StatCard label="Позитивные упоминания" value={overview?.positiveCount || 0} />
            <StatCard label="Количество отзывов" value={overview?.reviewsCount || 0} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card className="p-5">
              <div className="mb-4 text-base font-semibold">Разбивка по тональности</div>
              {sentiment.length ? (
                <div className="space-y-3 text-sm text-muted">
                  {sentiment.map((row: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-4 py-3">
                      <div>{row.sentiment || 'НЕИЗВЕСТНО'}</div>
                      <div>{row.count || 0}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">Данных по тональности пока нет.</div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-4 text-base font-semibold">Площадки</div>
              {platforms?.items?.length ? (
                <div className="space-y-3 text-sm text-muted">
                  {platforms.items.map((row: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-4 py-3">
                      <div>{row.platform || 'НЕИЗВЕСТНО'}</div>
                      <div>{row.count || 0}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">Данных по площадкам пока нет.</div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
