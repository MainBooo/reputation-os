import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { getCompanies } from '@/lib/api/companies'
import CompaniesCreateForm from '@/components/companies/CompaniesCreateForm'
import DeleteCompanyButton from '@/components/companies/DeleteCompanyButton'

type CompanyStatus = 'active' | 'pending' | 'draft'

function getMentionsCount(company: any) {
  return Number(company?._count?.mentions || 0)
}

function getActiveSourceTargets(company: any) {
  if (!Array.isArray(company?.sourceTargets)) return []
  return company.sourceTargets.filter((target: any) => target?.isActive !== false)
}

function getAliasesCount(company: any) {
  return Array.isArray(company?.aliases) ? company.aliases.length : 0
}

function getCompanyStatus(company: any): CompanyStatus {
  const sourcesCount = getActiveSourceTargets(company).length
  const mentionsCount = getMentionsCount(company)

  if (sourcesCount > 0 && mentionsCount > 0) return 'active'
  if (sourcesCount > 0) return 'pending'
  return 'draft'
}

function getStatusLabel(status: CompanyStatus) {
  if (status === 'active') return 'Мониторинг активен'
  if (status === 'pending') return 'Ожидает данные'
  return 'Требует настройки'
}

function getStatusClasses(status: CompanyStatus) {
  if (status === 'active') {
    return {
      card: 'border-emerald-400/25 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_34%),rgba(15,23,42,0.72)] shadow-[0_0_34px_rgba(16,185,129,0.08)]',
      badge: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
      dot: 'bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.65)]'
    }
  }

  if (status === 'pending') {
    return {
      card: 'border-amber-400/20 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.1),transparent_34%),rgba(15,23,42,0.7)]',
      badge: 'border-amber-400/30 bg-amber-500/15 text-amber-100',
      dot: 'bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.55)]'
    }
  }

  return {
    card: 'border-white/10 bg-panel',
    badge: 'border-white/10 bg-white/[0.05] text-muted',
    dot: 'bg-slate-500'
  }
}

function sortCompanies(companies: any[]) {
  const order: Record<CompanyStatus, number> = {
    active: 0,
    pending: 1,
    draft: 2
  }

  return [...companies].sort((a, b) => {
    const statusDiff = order[getCompanyStatus(a)] - order[getCompanyStatus(b)]
    if (statusDiff !== 0) return statusDiff
    return getMentionsCount(b) - getMentionsCount(a)
  })
}

function CompanyCard({ company, featured = false }: { company: any; featured?: boolean }) {
  const status = getCompanyStatus(company)
  const classes = getStatusClasses(status)
  const mentionsCount = getMentionsCount(company)
  const sourcesCount = getActiveSourceTargets(company).length
  const aliasesCount = getAliasesCount(company)

  return (
    <Card className={`relative overflow-hidden p-5 transition hover:bg-white/[0.035] ${classes.card}`}>
      {status === 'active' ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <Link href={`/companies/${company.id}`} className="block min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${classes.dot}`} />
              <div className="truncate text-xl font-semibold text-brand">{company.name}</div>
            </div>

            <div className="mt-2 text-sm text-muted">
              {company.website || 'Без сайта'} · {company.city || 'Город не указан'} · {company.industry || 'Отрасль не указана'}
            </div>
          </Link>

          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${classes.badge}`}>
            {getStatusLabel(status)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-xs text-muted">Упоминания</div>
            <div className="mt-1 text-xl font-semibold text-brand">{mentionsCount}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-xs text-muted">Источники</div>
            <div className="mt-1 text-xl font-semibold text-brand">{sourcesCount}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-xs text-muted">Ключи</div>
            <div className="mt-1 text-xl font-semibold text-brand">{aliasesCount}</div>
          </div>
        </div>

        {featured ? (
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100">
            Компания уже собирает данные. Можно сразу перейти во входящие и обработать найденные отзывы.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/companies/${company.id}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-brand transition hover:bg-white/[0.08]"
            >
              Карточка
            </Link>

            <Link
              href={`/companies/${company.id}/inbox`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Inbox
            </Link>
          </div>

          <DeleteCompanyButton id={company.id} name={company.name} />
        </div>
      </div>
    </Card>
  )
}

export default async function CompaniesPage() {
  let companies: any[] = []
  let authRequired = false

  try {
    companies = await getCompanies()
  } catch {
    authRequired = true
    companies = []
  }

  const sortedCompanies = sortCompanies(Array.isArray(companies) ? companies : [])
  const activeCompanies = sortedCompanies.filter((company) => getCompanyStatus(company) === 'active')
  const pendingCompanies = sortedCompanies.filter((company) => getCompanyStatus(company) === 'pending')
  const draftCompanies = sortedCompanies.filter((company) => getCompanyStatus(company) === 'draft')
  const otherCompanies = [...pendingCompanies, ...draftCompanies]

  return (
    <div>
      <PageHeader
        title="Компании"
        subtitle="Управление компаниями, источниками, ключевыми словами и рабочими пространствами мониторинга."
      />

      <div className="mb-6">
        <CompaniesCreateForm />
      </div>

      {authRequired ? (
        <EmptyState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить список компаний из API."
        />
      ) : sortedCompanies.length ? (
        <div className="space-y-6">
          {activeCompanies.length ? (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-brand">Действующие компании</div>
                  <div className="mt-1 text-sm text-muted">
                    Компании с подключёнными источниками и найденными упоминаниями.
                  </div>
                </div>

                <Badge>{activeCompanies.length} активных</Badge>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {activeCompanies.map((company) => (
                  <CompanyCard key={company.id} company={company} featured />
                ))}
              </div>
            </section>
          ) : null}

          {otherCompanies.length ? (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-brand">
                    {activeCompanies.length ? 'Ожидают настройки' : 'Компании'}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    Подключите источники и ключевые слова, чтобы карточки перешли в активный мониторинг.
                  </div>
                </div>

                <Badge>{otherCompanies.length} всего</Badge>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {otherCompanies.map((company) => (
                  <CompanyCard key={company.id} company={company} />
                ))}
              </div>
            </section>
          ) : null}
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
