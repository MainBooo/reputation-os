import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { getCompany } from '@/lib/api/companies'

export default async function CompanyPage({ params }: { params: { id: string } }) {
  const company: any = await getCompany(params.id)

  return (
    <div>
      <PageHeader
        title={company.name}
        subtitle={`${company.website || 'No website'} · ${company.city || 'No city'} · ${company.industry || 'No industry'}`}
        actions={
          <>
            <Link href={`/companies/${params.id}/inbox`}><Button variant="secondary">Inbox</Button></Link>
            <Link href={`/companies/${params.id}/vk`}><Button>VK</Button></Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mentions" value={company._count?.mentions || 0} />
        <StatCard label="Rating snapshots" value={company._count?.ratingSnapshots || 0} />
        <StatCard label="Connected sources" value={company.sourceTargets?.length || 0} />
        <StatCard label="Aliases" value={company.aliases?.length || 0} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Card className="p-5">
          <div className="text-base font-semibold">Company info</div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            <div>Name: <span className="text-brand">{company.name}</span></div>
            <div>Website: <span className="text-brand">{company.website || '—'}</span></div>
            <div>City: <span className="text-brand">{company.city || '—'}</span></div>
            <div>Industry: <span className="text-brand">{company.industry || '—'}</span></div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold">Aliases</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(company.aliases || []).map((alias: any) => <Badge key={alias.id}>{alias.value}</Badge>)}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Connected sources</div>
          <div className="space-y-3">
            {(company.sourceTargets || []).map((target: any) => (
              <div key={target.id} className="rounded-xl border border-line bg-panel2 px-4 py-3 text-sm">
                <div className="font-medium">{target.source?.name || 'Source'}</div>
                <div className="mt-1 text-muted">{target.displayName || target.externalUrl || target.externalPlaceId || 'No target details'}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Sync actions</div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary">Discover sources</Button>
            <Button>Start sync</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
