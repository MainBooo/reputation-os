import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import AdminUsersTable from '@/components/admin/AdminUsersTable'
import { getAdminOverview, getAdminUsers, getAdminWorkspaces } from '@/lib/api/admin'
import { Users, Building2, BriefcaseBusiness, MessageSquareText } from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatNumber(value: unknown) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0))
}

function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="overflow-hidden rounded-[28px] border-white/10 bg-[#070b16]/95 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</div>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  )
}

function roleLabel(role?: string) {
  if (role === 'OWNER') return 'Владелец'
  if (role === 'ADMIN') return 'Админ'
  if (role === 'MEMBER') return 'Участник'
  return role || '—'
}

export default async function AdminPage() {
  let overview: any = null
  let users: any[] = []
  let workspaces: any[] = []
  let forbidden = false

  try {
    const [overviewResult, usersResult, workspacesResult] = await Promise.all([
      getAdminOverview(),
      getAdminUsers(),
      getAdminWorkspaces()
    ])

    overview = overviewResult
    users = Array.isArray(usersResult) ? usersResult : []
    workspaces = Array.isArray(workspacesResult) ? workspacesResult : []
  } catch {
    forbidden = true
  }

  if (forbidden) {
    return (
      <div>
        <PageHeader title="Админ-панель" subtitle="Глобальное управление ReputationOS." />
        <EmptyState
          title="Доступ запрещён"
          description="Эта страница доступна только SUPER_ADMIN."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Админ-панель"
        subtitle="Глобальный обзор пользователей, workspace и данных платформы."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} label="Пользователи" value={formatNumber(overview?.usersCount)} />
        <KpiCard icon={Building2} label="Workspace" value={formatNumber(overview?.workspacesCount)} />
        <KpiCard icon={BriefcaseBusiness} label="Компании" value={formatNumber(overview?.companiesCount)} />
        <KpiCard icon={MessageSquareText} label="Упоминания" value={formatNumber(overview?.mentionsCount)} />
      </div>

      <AdminUsersTable initialUsers={users} />

      <Card className="mt-6 overflow-hidden rounded-[30px] border-white/10 bg-[#070b16]/95 p-0">
        <div className="border-b border-white/10 p-5">
          <div className="text-xl font-semibold text-white">Workspace</div>
          <div className="mt-1 text-sm text-zinc-400">Рабочие пространства клиентов.</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Название</th>
                <th className="px-5 py-3">Slug</th>
                <th className="px-5 py-3">Участники</th>
                <th className="px-5 py-3">Компании</th>
                <th className="px-5 py-3">Создан</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {workspaces.map((workspace) => (
                <tr key={workspace.id} className="text-zinc-300">
                  <td className="px-5 py-4 font-semibold text-white">{workspace.name}</td>
                  <td className="px-5 py-4 text-zinc-500">{workspace.slug}</td>
                  <td className="px-5 py-4">{formatNumber(workspace._count?.members)}</td>
                  <td className="px-5 py-4">{formatNumber(workspace._count?.companies)}</td>
                  <td className="px-5 py-4 text-zinc-500">
                    {workspace.createdAt ? new Date(workspace.createdAt).toLocaleDateString('ru-RU') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
