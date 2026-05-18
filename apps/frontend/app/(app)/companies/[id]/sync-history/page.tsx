import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { getCompany, getCompanySyncStatus } from '@/lib/api/companies'

const QUEUE_FILTERS = [
  { value: '', label: 'Все' },
  { value: 'reviews_sync', label: 'Отзывы' },
  { value: 'mentions_sync', label: 'WEB' },
  { value: 'rating_refresh', label: 'Рейтинг' }
]

const STATUS_FILTERS = [
  { value: '', label: 'Все статусы' },
  { value: 'SUCCESS', label: 'Успешно' },
  { value: 'FAILED', label: 'Ошибки' },
  { value: 'PENDING', label: 'Ожидают' },
  { value: 'RUNNING', label: 'В процессе' }
]


function relativeTimeLabel(value?: string | Date | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return 'только что'
  if (diffMinutes < 60) return `${diffMinutes} мин назад`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} ч назад`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} дн назад`
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function durationLabel(start?: string | Date | null, finish?: string | Date | null) {
  if (!start || !finish) return '—'
  const a = new Date(start).getTime()
  const b = new Date(finish).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '—'

  const seconds = Math.round((b - a) / 1000)
  if (seconds < 60) return `${seconds} сек`
  return `${Math.floor(seconds / 60)} мин ${seconds % 60} сек`
}

function statusLabel(value?: string | null) {
  if (value === 'RUNNING') return 'Выполняется'
  if (value === 'SUCCESS') return 'Успешно'
  if (value === 'FAILED') return 'Ошибка'
  if (value === 'PENDING') return 'Ожидает'
  return value || 'Неизвестно'
}

function statusClass(value?: string | null) {
  if (value === 'SUCCESS') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
  if (value === 'FAILED') return 'border-red-400/25 bg-red-500/10 text-red-100'
  if (value === 'RUNNING') return 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100'
  return 'border-white/10 bg-white/[0.04] text-zinc-300'
}

function queueLabel(value?: string | null) {
  if (value === 'reviews_sync') return 'Отзывы'
  if (value === 'mentions_sync') return 'WEB'
  if (value === 'rating_refresh') return 'Рейтинг'
  return value || 'Очередь'
}

function metric(value: unknown) {
  return typeof value === 'number' ? value : '—'
}

function filterHref(companyId: string, queue: string, status: string) {
  const params = new URLSearchParams()
  if (queue) params.set('queue', queue)
  if (status) params.set('status', status)
  const query = params.toString()
  return `/companies/${companyId}/sync-history${query ? `?${query}` : ''}`
}

export default async function SyncHistoryPage({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams?: { queue?: string; status?: string }
}) {
  let company: any = null
  let syncStatus: any = null
  let authRequired = false

  try {
    const [companyData, syncStatusData] = await Promise.all([
      getCompany(params.id),
      getCompanySyncStatus(params.id)
    ])

    company = companyData
    syncStatus = syncStatusData
  } catch {
    authRequired = true
  }

  if (authRequired) {
    return (
      <div className="space-y-4 pb-28">
        <PageHeader title="История синхронизаций" subtitle="Запуски сборов, результаты и ошибки." />
        <EmptyState title="Требуется авторизация" description="Войдите в систему, чтобы посмотреть историю синхронизаций." />
      </div>
    )
  }

  const queueFilter = searchParams?.queue || ''
  const statusFilter = searchParams?.status || ''

  const logs = Array.isArray(syncStatus?.logs) ? syncStatus.logs : []
  const sortedLogs = logs
    .slice()
    .sort((a: any, b: any) => new Date(b.createdAt || b.startedAt || 0).getTime() - new Date(a.createdAt || a.startedAt || 0).getTime())

  const filteredLogs = sortedLogs.filter((log: any) => {
    if (queueFilter && log?.queueName !== queueFilter) return false
    if (statusFilter && log?.jobStatus !== statusFilter) return false
    return true
  })

  const failedLogs = sortedLogs.filter((log: any) => log?.jobStatus === 'FAILED')
  const successLogs = sortedLogs.filter((log: any) => log?.jobStatus === 'SUCCESS')
  const runningLogs = sortedLogs.filter((log: any) => log?.jobStatus === 'RUNNING' || log?.jobStatus === 'PENDING')

  return (
    <div className="space-y-4 pb-28">
      <PageHeader
        title={`История синхронизаций${company?.name ? ` · ${company.name}` : ''}`}
        subtitle="Когда запускался сбор, сколько найдено данных и какие ошибки возникали."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-emerald-400/15 bg-emerald-500/[0.04] p-4">
          <div className="text-2xl font-semibold text-emerald-100">{successLogs.length}</div>
          <div className="mt-1 text-sm text-zinc-300">успешных запусков</div>
        </Card>
        <Card className="border-red-400/15 bg-red-500/[0.04] p-4">
          <div className="text-2xl font-semibold text-red-100">{failedLogs.length}</div>
          <div className="mt-1 text-sm text-zinc-300">ошибок</div>
        </Card>
        <Card className="border-cyan-400/15 bg-cyan-500/[0.04] p-4">
          <div className="text-2xl font-semibold text-cyan-100">{runningLogs.length}</div>
          <div className="mt-1 text-sm text-zinc-300">ожидают/в процессе</div>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 text-sm font-semibold text-white">Фильтры журнала</div>

        <div className="flex flex-wrap items-center gap-2">
          {QUEUE_FILTERS.map((item) => (
            <Link
              key={item.value || 'all-queue'}
              href={filterHref(params.id, item.value, statusFilter)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                queueFilter === item.value
                  ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}

          <span className="mx-1 hidden h-8 w-px bg-white/10 sm:block" />

          {STATUS_FILTERS.map((item) => (
            <Link
              key={item.value || 'all-status'}
              href={filterHref(params.id, queueFilter, item.value)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                statusFilter === item.value
                  ? 'border-violet-400/30 bg-violet-500/15 text-violet-100'
                  : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}

          {(queueFilter || statusFilter) ? (
            <Link
              href={`/companies/${params.id}/sync-history`}
              className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20"
            >
              Сбросить
            </Link>
          ) : null}
        </div>
      </Card>

      {failedLogs.length > 0 ? (
        <Card className="border-red-400/20 bg-red-500/[0.04] p-5">
          <div className="text-lg font-semibold text-red-100">Последние ошибки</div>
          <div className="mt-4 space-y-3">
            {failedLogs.slice(0, 3).map((log: any) => (
              <div key={log.id} className="rounded-2xl border border-red-400/15 bg-red-500/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">{queueLabel(log.queueName)} · {log.jobName}</div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(log.jobStatus)}`}>
                    {statusLabel(log.jobStatus)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-zinc-400">{formatDateTime(log.createdAt || log.startedAt)}</div>
                <div className="mt-3 text-sm leading-6 text-red-100">{log.errorMessage || 'Ошибка без текста.'}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden border-white/10 bg-[#050816] p-0">
        <div className="border-b border-white/10 p-5">
          <div className="text-lg font-semibold text-white">Журнал запусков</div>
          <div className="mt-1 text-sm text-zinc-400">Показано: {filteredLogs.length} из {sortedLogs.length}</div>
        </div>

        {filteredLogs.length > 0 ? (
          <div className="divide-y divide-white/10">
            {filteredLogs.map((log: any) => (
              <div key={log.id} className="grid gap-3 p-4 md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center">
                <div>
                  <div className="text-sm font-semibold text-white">{queueLabel(log.queueName)}</div>
                  <div className="mt-1 text-xs text-zinc-400">{log.jobName}</div>
                </div>

                <div className="text-xs text-zinc-300">
                  <div>Создано: {formatDateTime(log.createdAt)} · {relativeTimeLabel(log.createdAt)}</div>
                  <div className="mt-1">Завершено: {formatDateTime(log.finishedAt)}</div>
                  <div className="mt-1">Длительность: {durationLabel(log.startedAt || log.createdAt, log.finishedAt)}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <div className="font-semibold text-white">{metric(log.itemsDiscovered)}</div>
                    <div className="mt-1 text-zinc-500">найдено</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <div className="font-semibold text-white">{metric(log.itemsCreated)}</div>
                    <div className="mt-1 text-zinc-500">новых</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <div className="font-semibold text-white">{metric(log.itemsUpdated)}</div>
                    <div className="mt-1 text-zinc-500">обновл.</div>
                  </div>
                </div>

                <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(log.jobStatus)}`}>
                  {statusLabel(log.jobStatus)}
                </span>

                {log.errorMessage ? (
                  <div className="md:col-span-4 rounded-xl border border-red-400/15 bg-red-500/[0.04] p-3 text-sm text-red-100">
                    {log.errorMessage}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState title="По фильтрам ничего нет" description="Сбросьте фильтры или дождитесь новых запусков синхронизации." />
          </div>
        )}
      </Card>
    </div>
  )
}
