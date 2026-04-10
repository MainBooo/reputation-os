export const dynamic = 'force-dynamic'

import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import VkPostSearchPanel from '@/components/vk/VkPostSearchPanel'
import VkConnectionCard from '@/components/vk/VkConnectionCard'
import VkMentionsList from '@/components/vk/VkMentionsList'
import { getVkOverview, getVkCompanySearchProfile, getVkSession } from '@/lib/api/vk'

function OverviewCards({ overview }: { overview: any }) {
  const items = [['Найденные комментарии VK', overview?.relevantVkMentionsCount ?? 0]]

  return (
    <div className="grid gap-4 md:grid-cols-1">
      {items.map(([label, value]) => (
        <Card key={String(label)} className="p-5">
          <div className="text-sm text-muted">{label}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-brand">{value}</div>
        </Card>
      ))}
    </div>
  )
}

export default async function CompanyVkPage({ params }: { params: { id: string } }) {
  const [overviewRes, companySearchProfileRes, sessionRes] = await Promise.allSettled([
    getVkOverview(params.id),
    getVkCompanySearchProfile(params.id),
    getVkSession(params.id)
  ])

  const overview: any =
    overviewRes.status === 'fulfilled'
      ? overviewRes.value
      : {
          discoveredVkPostsCount: 0,
          relevantVkMentionsCount: 0,
          recentMentions: []
        }

  const companySearchProfile: any =
    companySearchProfileRes.status === 'fulfilled'
      ? companySearchProfileRes.value
      : {
          includeKeywords: [],
          excludeKeywords: [],
          contextKeywords: [],
          geoKeywords: [],
          category: null
        }

  const sessionError =
    sessionRes.status === 'rejected'
      ? sessionRes.reason instanceof Error
        ? sessionRes.reason.message
        : 'Не удалось получить состояние VK-сессии'
      : ''

  const session =
    sessionRes.status === 'fulfilled'
      ? sessionRes.value
      : null

  const mentions = Array.isArray(overview?.recentMentions) ? overview.recentMentions : []

  return (
    <div>
      <PageHeader
        title="Мониторинг VK"
        subtitle="Здесь доступны подключение VK, запуск Playwright-поиска по названию компании и просмотр найденных комментариев."
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(280px,360px),1fr]">
        <VkConnectionCard companyId={params.id} session={session} sessionError={sessionError} />
        <VkPostSearchPanel companyId={params.id} initialProfile={companySearchProfile} sessionConnected={session?.connected === true} />
      </div>

      <div className="mt-6">
        <OverviewCards overview={overview} />
      </div>

      <div className="mt-6">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Найденные комментарии и упоминания VK</div>
          <VkMentionsList
            companyId={params.id}
            initialMentions={mentions}
            total={overview?.relevantVkMentionsCount ?? 0}
          />
        </Card>
      </div>
    </div>
  )
}
