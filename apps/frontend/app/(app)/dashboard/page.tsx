import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Link from 'next/link'
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
        title="Дашборд"
        subtitle="Сводный обзор репутации по отзывам, упоминаниям, рейтингам и активности ВКонтакте."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Компании" value={companies.length} />
        <StatCard label="Подключённые источники" value={connectedSources} />
        <StatCard label="Количество упоминаний" value={mentionsCount} />
        <StatCard label="Статус авторизации" value={companies.length ? 'Активна' : 'Требуется вход'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr,1fr]">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Последние упоминания</div>
          {!companies.length ? (
            <EmptyState
              title="Нет данных из API"
              description="Войдите в систему, чтобы загрузить компании и живые данные из API."
            />
          ) : (
            <div className="text-sm text-muted">
              Откройте карточку компании, чтобы посмотреть реальные упоминания во входящих.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold">Последняя активность</div>
          <div className="mt-4 space-y-3 text-sm text-muted">
            {!companies.length ? (
              <div>Авторизуйтесь в приложении, чтобы загрузить реальные данные вместо пустого состояния.</div>
            ) : (
              <div>Откройте компанию и используйте разделы Inbox, VK, Analytics и Ratings.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
