import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import WebMentionsList from '@/components/web/WebMentionsList'
import WebSourceSetupCard from '@/components/web/WebSourceSetupCard'
import { getCompany } from '@/lib/api/companies'
import { getCompanyMentions } from '@/lib/api/mentions'

export const dynamic = 'force-dynamic'

function isMapOrReviewPlatformUrl(value?: string | null) {
  if (!value) return false

  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')

    return (
      host === '2gis.ru' ||
      host.endsWith('.2gis.ru') ||
      host === 'yandex.ru' ||
      host.endsWith('.yandex.ru') ||
      host === 'yandex.com' ||
      host.endsWith('.yandex.com')
    )
  } catch {
    const normalized = value.toLowerCase()
    return normalized.includes('2gis.ru') || normalized.includes('yandex.ru/maps')
  }
}

export default async function CompanyWebPage({ params }: { params: { id: string } }) {
  const [companyResult, mentionsResult] = await Promise.allSettled([
    getCompany(params.id),
    getCompanyMentions(params.id, '?page=1&limit=100&platform=WEB')
  ])

  const company = companyResult.status === 'fulfilled' ? companyResult.value : null
  const mentionsResponse =
    mentionsResult.status === 'fulfilled'
      ? mentionsResult.value
      : { data: [], meta: { total: 0, page: 1, limit: 100 } }

  const mentions = Array.isArray(mentionsResponse?.data)
    ? mentionsResponse.data.filter((mention: any) => {
        if (mention.platform !== 'WEB') return false
        return !isMapOrReviewPlatformUrl(mention.url || mention.sourceUrl)
      })
    : []

  const total = mentions.length

  if (!company) {
    return (
      <div>
        <PageHeader title="Сеть" subtitle="Компания не найдена или недоступна." />
        <EmptyState title="Компания недоступна" description="Проверьте доступ к компании и попробуйте снова." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Сеть"
        subtitle={`WEB-упоминания ${(company as { name?: string }).name || 'компании'}: статьи, страницы, RSS, каталоги, афиша и релевантная выдача.`}
      />

      <div className="space-y-5">
        <WebSourceSetupCard companyId={params.id} />

        <Card className="p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-lg font-semibold text-brand">WEB-упоминания</div>
              <div className="mt-2 text-sm leading-6 text-muted">
                Только сетевые источники. Яндекс Карты и 2GIS остаются в Inbox.
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100">
              Найдено: {total}
            </div>
          </div>

          <WebMentionsList companyId={params.id} initialMentions={mentions} />
        </Card>
      </div>
    </div>
  )
}
