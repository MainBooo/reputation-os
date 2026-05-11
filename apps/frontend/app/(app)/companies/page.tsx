import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { getCompanies } from '@/lib/api/companies'
import CompaniesCreateForm from '@/components/companies/CompaniesCreateForm'
import DeleteCompanyButton from '@/components/companies/DeleteCompanyButton'
import { CheckCircle2, Database, Globe, Inbox, KeyRound, MapPin, MessageSquare, PanelsTopLeft, Tag } from 'lucide-react'

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
  const mentionsCount = getMentionsCount(company)
  const sourcesCount = getActiveSourceTargets(company).length
  const aliasesCount = getAliasesCount(company)
  const statusLabel = getStatusLabel(status)

  const statusClasses =
    status === 'active'
      ? {
          badge: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.16)]',
          dot: 'bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.9)]'
        }
      : status === 'pending'
        ? {
            badge: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
            dot: 'bg-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.65)]'
          }
        : {
            badge: 'border-white/10 bg-white/[0.05] text-white/55',
            dot: 'bg-slate-500'
          }

  const meta = [
    { icon: Globe, value: company.website || 'Без сайта' },
    { icon: MapPin, value: company.city || 'Город не указан' },
    { icon: Tag, value: company.industry || 'Отрасль не указана' }
  ]

  const metrics = [
    { label: 'Упоминания', value: mentionsCount, icon: MessageSquare, tone: 'border-violet-400/10 bg-violet-500/10 text-violet-300' },
    { label: 'Источники', value: sourcesCount, icon: Database, tone: 'border-sky-400/10 bg-sky-500/10 text-sky-300' },
    { label: 'Ключи', value: aliasesCount, icon: KeyRound, tone: 'border-emerald-400/10 bg-emerald-500/10 text-emerald-300' }
  ]

  return (
    <Card className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[#08111d]/95 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.42),0_0_42px_rgba(34,211,238,0.08)] transition hover:border-cyan-400/20 hover:shadow-[0_26px_90px_rgba(0,0,0,0.48),0_0_62px_rgba(34,211,238,0.16)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.16),transparent_36%),radial-gradient(circle_at_100%_18%,rgba(16,185,129,0.08),transparent_28%)]" />

      <div className="relative flex flex-col gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <span className={`mt-8 h-2.5 w-2.5 shrink-0 rounded-full ${statusClasses.dot}`} />

          <Link href={`/companies/${company.id}`} className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-white text-2xl font-semibold text-slate-950">
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt={company.name || 'Логотип компании'} className="h-full w-full object-cover" />
                ) : (
                  String(company.name || 'R').trim().slice(0, 1).toUpperCase()
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[28px] font-semibold leading-[0.95] tracking-[-0.04em] text-white sm:text-[32px]">
                  {company.name}
                </div>
                <span className={`mt-2 inline-flex w-fit rounded-full border px-4 py-2 text-sm font-semibold ${statusClasses.badge}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-white/50">
          {meta.map((item, index) => {
            const Icon = item.icon
            return (
              <div key={`${item.value}-${index}`} className="flex items-center gap-3">
                {index > 0 ? <span className="h-1 w-1 rounded-full bg-white/20" /> : null}
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="max-w-[180px] truncate">{item.value}</span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.label} className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-2xl border ${metric.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="truncate text-sm text-white/50">{metric.label}</div>
                <div className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.04em] text-white">{metric.value}</div>
              </div>
            )
          })}
        </div>

        {featured ? (
          <div className="flex gap-3 rounded-[24px] border border-emerald-400/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(0,153,255,0.08))] p-4 text-sm leading-[1.55] text-emerald-50/90">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <span>Компания уже собирает данные. Можно сразу перейти во входящие и обработать найденные отзывы.</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/companies/${company.id}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:bg-white/[0.07]"
            >
              <PanelsTopLeft className="h-4 w-4" />
              Карточка
            </Link>

            <Link
              href={`/companies/${company.id}/inbox`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[20px] border border-cyan-400/20 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)] transition hover:bg-cyan-500/20"
            >
              <Inbox className="h-4 w-4" />
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Компании"
          subtitle="Управление компаниями, источниками, ключевыми словами и рабочими пространствами мониторинга."
        />

        <a
          href="#add-company"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
        >
          Добавить компанию
        </a>
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
              <div className="relative mb-4 overflow-hidden rounded-[32px] border border-white/10 bg-[#07111f] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:flex sm:items-center sm:justify-between sm:gap-3">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.18),transparent_34%)]" />
                <div className="relative">
                  <div className="text-[30px] font-semibold leading-none tracking-[-0.04em] text-white">Действующие компании</div>
                  <div className="mt-3 max-w-xl text-sm leading-[1.55] text-white/55">
                    Компании с подключёнными источниками и найденными упоминаниями.
                  </div>
                </div>

                <span className="relative mt-4 inline-flex rounded-[26px] border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.08)] sm:mt-0">
                  {activeCompanies.length} активных
                </span>
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
              <div className="relative mb-4 overflow-hidden rounded-[32px] border border-white/10 bg-[#050b14] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.3)] sm:flex sm:items-center sm:justify-between sm:gap-3">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.13),transparent_34%)]" />
                <div className="relative">
                  <div className="text-[30px] font-semibold leading-none tracking-[-0.04em] text-white">
                    {activeCompanies.length ? 'Ожидают настройки' : 'Компании'}
                  </div>
                  <div className="mt-3 max-w-xl text-sm leading-[1.55] text-white/55">
                    Подключите источники и ключевые слова, чтобы карточки перешли в активный мониторинг.
                  </div>
                </div>

                <span className="relative mt-4 inline-flex rounded-[26px] border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-cyan-100 sm:mt-0">
                  {otherCompanies.length} всего
                </span>
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

      <div id="add-company" className="mt-8 scroll-mt-24">
        <CompaniesCreateForm />
      </div>
    </div>
  )
}
