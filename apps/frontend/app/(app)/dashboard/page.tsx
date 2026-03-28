import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { getCompanies } from '@/lib/api/companies'

export default async function DashboardPage() {
  let companies: any[] = []

  try {
    companies = await getCompanies()
  } catch {
    companies = []
  }

  const connectedSources = companies.reduce((acc, c: any) => acc + (c.sourceTargets?.length || 0), 0)
  const mentionsCount = companies.reduce((acc, c: any) => acc + (c._count?.mentions || 0), 0)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Aggregated reputation view across reviews, mentions, ratings and VK activity."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Companies" value={companies.length} />
        <StatCard label="Connected sources" value={connectedSources} />
        <StatCard label="Mentions count" value={mentionsCount} />
        <StatCard label="Auth status" value={companies.length ? 'Connected' : 'Required'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr,1fr]">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Latest mentions</div>
          {!companies.length ? (
            <EmptyState
              title="No authenticated data"
              description="Login is required to load companies and live reputation data from the API."
            />
          ) : (
            <div className="text-sm text-muted">
              Open a company workspace to review live mentions in Inbox.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold">Recent activity</div>
          <div className="mt-4 space-y-3 text-sm text-muted">
            {!companies.length ? (
              <div>Authorize in the app to load live activity instead of fallback content.</div>
            ) : (
              <div>Open a company workspace and use Inbox / VK monitoring / Ratings pages.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
