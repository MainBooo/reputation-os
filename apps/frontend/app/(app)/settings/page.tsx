import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import PushSettingsCard from '@/components/settings/PushSettingsCard'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Настройки"
        subtitle="Профиль, уведомления, правила мониторинга и параметры рабочего пространства."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <PushSettingsCard />

        <Card className="p-5">
          <div className="text-base font-semibold text-brand">Правила уведомлений</div>
          <div className="mt-3 text-sm leading-6 text-muted">
            Скоро здесь будут условия: негативные отзывы, падение рейтинга, новые упоминания и ежедневные дайджесты.
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold text-brand">Workspace</div>
          <div className="mt-3 text-sm leading-6 text-muted">
            Настройки команды, источников и доступа к рабочему пространству.
          </div>
        </Card>
      </div>
    </div>
  )
}
