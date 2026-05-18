import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { getCompany, getCompanySyncStatus } from '@/lib/api/companies'
import { getCompanyMentions } from '@/lib/api/mentions'
import ReportPrintButton from '@/components/companies/ReportPrintButton'

function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU')
}

function ratingLabel(value: unknown) {
  const rating = Number(value)
  return Number.isFinite(rating) ? `${rating.toFixed(1)} ★` : '—'
}

function sentimentOf(mention: any) {
  const rating = mention?.ratingValue !== null && mention?.ratingValue !== undefined ? Number(mention.ratingValue) : null
  if (rating !== null && Number.isFinite(rating)) {
    if (rating >= 4) return 'POSITIVE'
    if (rating <= 2) return 'NEGATIVE'
    return 'NEUTRAL'
  }
  return mention?.sentiment || 'UNKNOWN'
}

function sentimentLabel(value: string) {
  if (value === 'POSITIVE') return 'Позитив'
  if (value === 'NEGATIVE') return 'Негатив'
  if (value === 'NEUTRAL') return 'Нейтрально'
  return 'Неизвестно'
}

function platformLabel(value?: string | null) {
  if (value === 'YANDEX') return 'Яндекс'
  if (value === 'TWOGIS') return '2ГИС'
  if (value === 'WEB') return 'WEB'
  return value || 'Источник'
}

function truncate(value?: string | null, limit = 180) {
  if (!value) return ''
  return value.length > limit ? `${value.slice(0, limit).trim()}…` : value
}

export default async function CompanyReportPage({ params }: { params: { id: string } }) {
  let company: any = null
  let mentionsResponse: any = { data: [], meta: { total: 0, averageRating: null, ratedCount: 0 } }
  let latestResponse: any = { data: [], meta: { total: 0 } }
  let negativeResponse: any = { data: [], meta: { total: 0 } }
  let syncStatus: any = null
  let authRequired = false

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const from = sevenDaysAgo.toISOString().slice(0, 10)

  try {
    const [companyData, mentionsData, latestData, negativeData, syncData] = await Promise.all([
      getCompany(params.id),
      getCompanyMentions(params.id, '?page=1&limit=100'),
      getCompanyMentions(params.id, '?page=1&limit=8'),
      getCompanyMentions(params.id, `?page=1&limit=20&sentiment=NEGATIVE&from=${from}`),
      getCompanySyncStatus(params.id)
    ])

    company = companyData
    mentionsResponse = mentionsData
    latestResponse = latestData
    negativeResponse = negativeData
    syncStatus = syncData
  } catch {
    authRequired = true
  }

  if (authRequired) {
    return (
      <div className="space-y-4 pb-28">
        <PageHeader title="Отчёт" subtitle="Репутационный отчёт компании." />
        <EmptyState title="Требуется авторизация" description="Войдите в систему, чтобы сформировать отчёт." />
      </div>
    )
  }

  const mentions = Array.isArray(mentionsResponse?.data) ? mentionsResponse.data : []
  const latest = Array.isArray(latestResponse?.data) ? latestResponse.data : []
  const negative = Array.isArray(negativeResponse?.data) ? negativeResponse.data : []

  const total = Number(mentionsResponse?.meta?.total || mentions.length || 0)
  const averageRating = mentionsResponse?.meta?.averageRating
  const ratedCount = Number(mentionsResponse?.meta?.ratedCount || 0)

  const positiveCount = mentions.filter((item: any) => sentimentOf(item) === 'POSITIVE').length
  const neutralCount = mentions.filter((item: any) => sentimentOf(item) === 'NEUTRAL').length
  const negativeCount = mentions.filter((item: any) => sentimentOf(item) === 'NEGATIVE').length

  const platforms = mentions.reduce((acc: Record<string, number>, mention: any) => {
    const key = mention?.platform || 'UNKNOWN'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const latestLog = Array.isArray(syncStatus?.logs) ? syncStatus.logs[0] : null

  const summary =
    negative.length > 0
      ? `За последние 7 дней обнаружены негативные сигналы. Рекомендуется проверить последние отзывы и закрыть проблемные обращения в течение 24 часов.`
      : `Критичных негативных сигналов за последние 7 дней не обнаружено. Репутационный фон выглядит стабильным.`

  return (
    <div className="space-y-5 pb-8 print:bg-white print:text-black">
      <div className="print:hidden">
        <PageHeader title="Репутационный отчёт" subtitle="Печатная версия для клиента, руководителя или маркетолога." />
        <div className="flex flex-wrap gap-2">
            <ReportPrintButton />
          <Link href={`/companies/${params.id}`} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200">
            Назад к компании
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden border-cyan-400/15 bg-[#050816] p-6 print:border-slate-200 print:bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300 print:text-slate-500">ReputationOS report</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white print:text-black">{company?.name || 'Компания'}</h1>
            <p className="mt-2 text-sm text-zinc-400 print:text-slate-600">Период анализа: последние 7–30 дней · сформировано {formatDate(new Date())}</p>
          </div>

          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-cyan-400/25 bg-cyan-500/10 text-2xl font-semibold text-cyan-100 print:border-slate-200 print:bg-slate-50 print:text-slate-800">
            {company?.logoUrl ? <img src={company.logoUrl} alt="" className="h-full w-full object-cover" /> : String(company?.name || 'R').slice(0, 1)}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4 print:border-slate-200 print:bg-white">
          <div className="text-2xl font-semibold text-cyan-100 print:text-black">{ratingLabel(averageRating)}</div>
          <div className="mt-1 text-sm text-zinc-400 print:text-slate-600">средний рейтинг</div>
        </Card>
        <Card className="p-4 print:border-slate-200 print:bg-white">
          <div className="text-2xl font-semibold text-white print:text-black">{total}</div>
          <div className="mt-1 text-sm text-zinc-400 print:text-slate-600">упоминаний</div>
        </Card>
        <Card className="p-4 print:border-slate-200 print:bg-white">
          <div className="text-2xl font-semibold text-red-100 print:text-black">{negative.length}</div>
          <div className="mt-1 text-sm text-zinc-400 print:text-slate-600">негатив за 7 дней</div>
        </Card>
        <Card className="p-4 print:border-slate-200 print:bg-white">
          <div className="text-2xl font-semibold text-emerald-100 print:text-black">{ratedCount}</div>
          <div className="mt-1 text-sm text-zinc-400 print:text-slate-600">отзывов с оценкой</div>
        </Card>
      </div>

      <Card className="p-5 print:border-slate-200 print:bg-white">
        <div className="text-xl font-semibold text-white print:text-black">AI summary</div>
        <p className="mt-3 text-sm leading-6 text-zinc-300 print:text-slate-700">{summary}</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 print:border-slate-200 print:bg-white">
          <div className="text-lg font-semibold text-white print:text-black">Тональность</div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between text-emerald-200 print:text-slate-800"><span>Позитив</span><b>{positiveCount}</b></div>
            <div className="flex justify-between text-amber-100 print:text-slate-800"><span>Нейтрально</span><b>{neutralCount}</b></div>
            <div className="flex justify-between text-red-200 print:text-slate-800"><span>Негатив</span><b>{negativeCount}</b></div>
          </div>
        </Card>

        <Card className="p-5 print:border-slate-200 print:bg-white">
          <div className="text-lg font-semibold text-white print:text-black">Источники</div>
          <div className="mt-4 space-y-3 text-sm text-zinc-300 print:text-slate-700">
            {Object.entries(platforms).length > 0 ? Object.entries(platforms).map(([platform, count]) => (
              <div key={platform} className="flex justify-between">
                <span>{platformLabel(platform)}</span>
                <b>{String(count)}</b>
              </div>
            )) : <div>Нет данных по источникам.</div>}
          </div>
        </Card>
      </div>

      <Card className="p-5 print:border-slate-200 print:bg-white">
        <div className="text-lg font-semibold text-white print:text-black">Последние важные упоминания</div>
        <div className="mt-4 space-y-3">
          {latest.length > 0 ? latest.map((mention: any) => (
            <div key={mention.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 print:border-slate-200 print:bg-white">
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400 print:text-slate-500">
                <span>{platformLabel(mention.platform)}</span>
                <span>•</span>
                <span>{sentimentLabel(sentimentOf(mention))}</span>
                <span>•</span>
                <span>{formatDate(mention.publishedAt || mention.createdAt)}</span>
              </div>
              <div className="mt-2 text-sm leading-6 text-white print:text-black">{truncate(mention.content || mention.title || 'Упоминание')}</div>
            </div>
          )) : <EmptyState title="Нет упоминаний" description="После сбора данных здесь появятся последние сигналы." />}
        </div>
      </Card>

      <Card className="p-5 print:border-slate-200 print:bg-white">
        <div className="text-lg font-semibold text-white print:text-black">Рекомендации</div>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300 print:text-slate-700">
          <li>— Отвечать на негативные отзывы в течение 24 часов.</li>
          <li>— Усилить сбор положительных отзывов на ключевых площадках.</li>
          <li>— Проверять WEB-упоминания и справочники не реже 1 раза в неделю.</li>
          <li>— Отслеживать падение рейтинга и всплески негатива.</li>
        </ul>
      </Card>

      <Card className="p-5 text-xs text-zinc-500 print:border-slate-200 print:bg-white print:text-slate-500">
        Последняя синхронизация: {formatDate(latestLog?.createdAt || latestLog?.finishedAt)} · Generated by ReputationOS
      </Card>
    </div>
  )
}
