import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { getRatingsOverview, getRatingsHistory } from '@/lib/api/ratings'

export default async function CompanyRatingsPage({ params }: { params: { id: string } }) {
  let overview: any = null
  let history: any[] = []
  let authRequired = false

  try {
    overview = await getRatingsOverview(params.id)
    history = await getRatingsHistory(params.id)
  } catch {
    authRequired = true
  }

  return (
    <div>
      <PageHeader
        title="Рейтинги"
        subtitle="Сводные рейтинги по подключённым источникам отзывов."
      />

      {authRequired ? (
        <EmptyState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить данные рейтингов из API."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Сводный рейтинг" value={overview?.aggregatedRating ?? '—'} />
            <StatCard label="Количество отзывов" value={overview?.reviewsCount || 0} />
            <StatCard label="Источники" value={overview?.sourcesCount || 0} />
            <StatCard label="Последнее обновление" value={overview?.lastRefreshAt ? 'Готово' : '—'} />
          </div>

          <div className="mt-6">
            <Card className="p-5">
              <div className="mb-4 text-base font-semibold">История рейтингов</div>
              {history.length ? (
                <div className="space-y-3 text-sm text-muted">
                  {history.map((row: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-4 py-3">
                      <div>{row.sourceName || row.platform || 'Источник'}</div>
                      <div>{row.ratingValue ?? '—'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">История рейтингов пока пуста.</div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
