import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import { Table, THead, TRow } from '@/components/ui/Table'
import { getRatingsHistory, getRatingsOverview } from '@/lib/api/ratings'
import SimpleLineChart from '@/components/charts/SimpleLineChart'

export default async function RatingsPage({ params }: { params: { id: string } }) {
  const overview: any = await getRatingsOverview(params.id)
  const history: any[] = await getRatingsHistory(params.id)

  const chartPoints = history.slice(-6).map((item, index) => ({
    label: new Date(item.capturedAt).toLocaleDateString(),
    value: Number(item.ratingValue)
  }))

  return (
    <div>
      <PageHeader title="Ratings" subtitle="Weighted overview and source-level history." />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Aggregated rating" value={overview.aggregatedRating ?? '—'} />
        <StatCard label="Tracked platforms" value={overview.platforms?.length || 0} />
        <StatCard label="History points" value={history.length} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Platform ratings</div>
          <Table>
            <THead>
              <div className="col-span-4">Platform</div>
              <div className="col-span-4">Rating</div>
              <div className="col-span-4 text-right">Reviews</div>
            </THead>
            {(overview.platforms || []).map((item: any) => (
              <TRow key={item.platform}>
                <div className="col-span-4">{item.platform}</div>
                <div className="col-span-4">{item.ratingValue}</div>
                <div className="col-span-4 text-right">{item.reviewsCount}</div>
              </TRow>
            ))}
          </Table>
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Rating history</div>
          <SimpleLineChart points={chartPoints} />
        </Card>
      </div>
    </div>
  )
}
