import PageHeader from '@/components/ui/PageHeader'
import PushSettingsCard from '@/components/settings/PushSettingsCard'
import WorkspaceTeamCard from '@/components/settings/WorkspaceTeamCard'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Настройки"
        subtitle="Рабочие параметры уведомлений и мониторинга."
      />

      <div className="w-full max-w-none">
        <PushSettingsCard />
      </div>
    </div>
  )
}
