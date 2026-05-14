import PageHeader from '@/components/ui/PageHeader'
import PushSettingsCard from '@/components/settings/PushSettingsCard'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Настройки"
        subtitle="Рабочие параметры уведомлений и мониторинга."
      />

      <div className="max-w-2xl">
        <PushSettingsCard />
      </div>
    </div>
  )
}
