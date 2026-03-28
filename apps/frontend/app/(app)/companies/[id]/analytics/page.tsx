import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import SimpleBarList from '@/components/charts/SimpleBarList'
import { getAnalyticsOverview, getAnalyticsPlatforms, getAnalyticsSentiment } from '@/lib/api/analytics'

export default async function AnalyticsPage({ params }: { params: { id: string } }) {
  const overview: any = await getAnalyticsOverview(params.id)
  const sentiment: any[] = await getAnalyticsSentiment(params.id)
  const platforms: any = await getAnalyticsPlatforms(params.id)

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Overview, sentiment distribution and platform comparison including VK." />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total mentions" value={overview.mentionsCount || 0} />
        <StatCard label="Negative mentions" value={overview.negativeCount || 0} />
        <StatCard label="Reviews count" value={overview.reviewsCount || 0} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Sentiment distribution</div>
          <SimpleBarList items={sentiment.map((item) => ({ label: item.sentiment, value: item.count }))} />
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Platform comparison</div>
          <SimpleBarList items={(platforms.platforms || []).map((item: any) => ({ label: item.platform, value: item.count }))} />
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">VK contribution</div>
          <div className="text-4xl font-semibold">{platforms.vkCount || 0}</div>
          <div className="mt-2 text-sm text-muted">VK mentions/comments included in platform analytics.</div>
        </Card>
      </div>
    </div>
  )
}
