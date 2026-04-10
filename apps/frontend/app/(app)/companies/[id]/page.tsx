import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import { getCompany } from '@/lib/api/companies'

export default async function CompanyPage({ params }: { params: { id: string } }) {
  let company: any = null
  let authRequired = false

  try {
    company = await getCompany(params.id)
  } catch {
    authRequired = true
  }

  if (authRequired) {
    return (
      <div>
        <PageHeader
          title="Карточка компании"
          subtitle="Обзор компании, источники и действия мониторинга."
        />
        <EmptyState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить карточку компании из API."
        />
      </div>
    )
  }

  if (!company) {
    return (
      <div>
        <PageHeader
          title="Карточка компании"
          subtitle="Обзор компании, источники и действия мониторинга."
        />
        <EmptyState
          title="Компания не найдена"
          description="Не удалось загрузить запрошенную компанию."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={company.name || 'Карточка компании'}
        subtitle="Обзор компании, источники и действия мониторинга."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Упоминания" value={company._count?.mentions || 0} />
        <StatCard label="Снимки рейтинга" value={company._count?.ratingSnapshots || 0} />
        
        <StatCard label="Алиасы" value={company.aliases?.length || 0} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Данные компании</div>
          <div className="space-y-2 text-sm text-muted">
            <div><span className="text-brand">Сайт:</span> {company.website || '—'}</div>
            <div><span className="text-brand">Город:</span> {company.city || '—'}</div>
            <div><span className="text-brand">Сфера:</span> {company.industry || '—'}</div>
          </div>
        </Card>

        
      </div>
    </div>
  )
}
