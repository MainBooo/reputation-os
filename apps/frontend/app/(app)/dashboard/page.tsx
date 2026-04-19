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
        title="Панель управления"
        subtitle="Краткий обзор системы мониторинга репутации, источников и входящих упоминаний."
      />

      <Card className="mb-6 p-5">
        <div className="space-y-4">
          <div>
            <div className="text-base font-semibold text-white">Как работает Reputation OS</div>
            <div className="mt-2 text-sm text-muted">
              Reputation OS помогает собирать отзывы, комментарии и упоминания компании в одном месте,
              чтобы вы могли быстро просматривать их, переходить к источнику и обрабатывать входящий поток.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
              <div className="text-sm font-medium text-white">Что можно сделать</div>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>• Добавить компанию и настроить источники мониторинга</li>
                <li>• Подключить VK и запускать поиск комментариев и упоминаний</li>
                <li>• Смотреть все найденные упоминания во Входящих</li>
                <li>• Открывать оригинальный источник и удалять нерелевантные записи</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
              <div className="text-sm font-medium text-white">С чего начать</div>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>1. Перейдите в раздел «Компании» и добавьте компанию</li>
                <li>2. Откройте карточку компании и подключите нужные источники</li>
                <li>3. Для VK запустите поиск постов и комментариев</li>
                <li>4. Откройте Inbox, чтобы просматривать и обрабатывать найденные упоминания</li>
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/companies">
                  <Button type="button">Открыть компании</Button>
                </Link>
                <Link href="/dashboard">
                  <Button type="button" variant="secondary">Обновить панель</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Card>

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
