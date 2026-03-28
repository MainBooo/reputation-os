import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import MentionRow from '@/components/mentions/MentionRow'
import { getCompanies } from '@/lib/api/companies'

export default async function DashboardPage() {
  const companies: any[] = await getCompanies()
  const firstCompany = companies[0]
  const latest = firstCompany?._count ? [
    {
      id: 'demo1',
      platform: 'VK',
      type: 'VK_COMMENT',
      content: 'Не рекомендую, задержали заказ',
      author: 'VK User',
      publishedAt: new Date().toISOString(),
      sentiment: 'NEGATIVE',
      status: 'NEW',
      url: 'https://vk.com'
    }
  ] : []

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Aggregated reputation view across reviews, mentions, ratings and VK activity."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aggregated rating" value="4.6" hint="Weighted average across sources" />
        <StatCard label="Connected sources" value={companies.reduce((acc, c: any) => acc + (c.sourceTargets?.length || 0), 0)} />
        <StatCard label="Reviews count" value={companies.reduce((acc, c: any) => acc + (c._count?.mentions || 0), 0)} />
        <StatCard label="Negative mentions" value="3" hint="Including VK mentions/comments" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr,1fr]">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Latest mentions</div>
          <div className="space-y-3">
            {latest.map((mention) => <MentionRow key={mention.id} mention={mention} />)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold">Recent activity</div>
          <div className="mt-4 space-y-3 text-sm text-muted">
            <div>VK monitoring found new relevant comments.</div>
            <div>Ratings refreshed for main review sources.</div>
            <div>Brand search is scheduled and ready.</div>
          </div>
        </Card>
      </div>
    </div>
  )
}
