import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import DiscoveryCenter from '@/components/web/DiscoveryCenter'
import { getCompany, getCompanySourceTargets, getCompanyWebSourcesOverview } from '@/lib/api/companies'

export const dynamic = 'force-dynamic'

export default async function CompanyWebPage({ params }: { params: { id: string } }) {
  const [companyResult, targetsResult, webOverviewResult] = await Promise.allSettled([
    getCompany(params.id),
    getCompanySourceTargets(params.id),
    getCompanyWebSourcesOverview(params.id)
  ])

  const company = companyResult.status === 'fulfilled' ? companyResult.value : null
  const targets = targetsResult.status === 'fulfilled' && Array.isArray(targetsResult.value) ? targetsResult.value : []
  const webOverview = webOverviewResult.status === 'fulfilled' ? webOverviewResult.value : null

  if (!company) {
    return (
      <div>
        <PageHeader title="Сеть" subtitle="Компания не найдена или недоступна." />
        <EmptyState title="Компания недоступна" description="Проверьте доступ к компании и попробуйте снова." />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-28">
      <PageHeader
        title="Сеть"
        subtitle="Управляйте внешними источниками мониторинга. Упоминания и сигналы попадают в Inbox."
      />

      <DiscoveryCenter companyId={params.id} initialTargets={targets} initialOverview={webOverview} />
    </div>
  )
}
