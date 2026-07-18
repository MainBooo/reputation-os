import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import TelegramScoutPanel from '@/components/telegram/TelegramScoutPanel'
import TelegramChannelsManager from '@/components/telegram/TelegramChannelsManager'
import { getCompany } from '@/lib/api/companies'

export const dynamic = 'force-dynamic'

export default async function CompanyTelegramPage({ params }: { params: { id: string } }) {
  const companyResult = await getCompany(params.id).catch(() => null)

  if (!companyResult) {
    return (
      <div>
        <PageHeader title="Telegram" subtitle="Компания не найдена или недоступна." />
        <EmptyState title="Компания недоступна" description="Проверьте доступ к компании и попробуйте снова." />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-28">
      <PageHeader
        title="Telegram"
        subtitle="Telegram Scout ищет упоминания компании в публичных каналах, группах и супергруппах."
      />

      <TelegramScoutPanel companyId={params.id} />
      <TelegramChannelsManager companyId={params.id} />
    </div>
  )
}
