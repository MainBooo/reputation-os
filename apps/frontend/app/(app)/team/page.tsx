import PageHeader from '@/components/ui/PageHeader'
import WorkspaceTeamCard from '@/components/settings/WorkspaceTeamCard'
import WorkspaceInvitesCard from '@/components/settings/WorkspaceInvitesCard'

export const dynamic = 'force-dynamic'

export default function TeamPage() {
  return (
    <div>
      <PageHeader
        title="Команда"
        subtitle="Участники workspace, роли и доступы к рабочему пространству."
      />

      <div className="w-full max-w-none">
        <WorkspaceTeamCard />
      </div>
    </div>
  )
}
