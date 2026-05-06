import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import DiscoveryCenter from '@/components/web/DiscoveryCenter'
import LatestWebMentions from '@/components/web/LatestWebMentions'
import { getCompany, getCompanySourceTargets } from '@/lib/api/companies'

export const dynamic = 'force-dynamic'

export default async function CompanyWebPage({ params }: { params: { id: string } }) {
  const [companyResult, targetsResult] = await Promise.allSettled([
    getCompany(params.id),
    getCompanySourceTargets(params.id)
  ])

  const company = companyResult.status === 'fulfilled' ? companyResult.value : null
  const targets = targetsResult.status === 'fulfilled' && Array.isArray(targetsResult.value) ? targetsResult.value : []

  if (!company) {
    return (
      <div>
        <PageHeader title="Сеть" subtitle="Компания не найдена или недоступна." />
        <EmptyState title="Компания недоступна" description="Проверьте доступ к компании и попробуйте снова." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Сеть"
        subtitle="Внешние площадки и страницы, где система находит упоминания компании."
      />

      <DiscoveryCenter companyId={params.id} initialTargets={targets} />
      <LatestWebMentions companyId={params.id} />
    </div>
  )
}
