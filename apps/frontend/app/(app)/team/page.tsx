import PageHeader from '@/components/ui/PageHeader'
import WorkspaceTeamCard from '@/components/settings/WorkspaceTeamCard'
import WorkspaceInvitesCard from '@/components/settings/WorkspaceInvitesCard'
import DirectChatStartCard from '@/components/chat/DirectChatStartCard'

export const dynamic = 'force-dynamic'

export default function TeamPage() {
  return (
    <div>
      <PageHeader
        title="Команда"
        subtitle="Участники workspace, роли и доступы к рабочему пространству."
      />

      <div className="w-full max-w-none space-y-4">
        <WorkspaceTeamCard />
        <DirectChatStartCard />
      </div>
    </div>
  )
}
