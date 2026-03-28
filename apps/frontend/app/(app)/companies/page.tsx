import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { getCompanies } from '@/lib/api/companies'

export default async function CompaniesPage() {
  let companies: any[] = []
  let authRequired = false

  try {
    companies = await getCompanies()
  } catch {
    authRequired = true
    companies = []
  }

  return (
    <div>
      <PageHeader
        title="Компании"
        subtitle="Управление компаниями и переход в рабочие пространства мониторинга."
      />

      {authRequired ? (
        <EmptyState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить список компаний из API."
        />
      ) : companies.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {companies.map((company) => (
            <Link key={company.id} href={`/companies/${company.id}`}>
              <Card className="p-5 transition hover:bg-white/[0.03]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold">{company.name}</div>
                    <div className="mt-2 text-sm text-muted">
                      {company.website || 'Без сайта'} · {company.city || 'Город не указан'} · {company.industry || 'Отрасль не указана'}
                    </div>
                  </div>

                  <Badge>
                    {company._count?.mentions || 0} упоминаний
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Компаний пока нет"
          description="Создайте первую компанию, чтобы начать мониторинг репутации."
        />
      )}
    </div>
  )
}
