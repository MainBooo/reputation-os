import PageHeader from '@/components/ui/PageHeader'
import PushSettingsCard from '@/components/settings/PushSettingsCard'
import BillingCard from '@/components/billing/BillingCard'
import FeatureGate from '@/components/billing/FeatureGate'
import { TelegramConnectSection } from '@/components/settings/TelegramConnectSection'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Настройки"
        subtitle="Рабочие параметры уведомлений и мониторинга."
      />

      <div className="w-full max-w-none">
        <BillingCard />
        <div className="mt-4" />
        <PushSettingsCard />
        <div className="mt-4" />
        <FeatureGate feature="telegramNotifications">
          <TelegramConnectSection />
        </FeatureGate>
      </div>
    </div>
  )
}
