import Card from '@/components/ui/Card'

function formatDateTime(value?: string | Date | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function statusLabel(value?: string | null) {
  if (value === 'RUNNING') return 'Выполняется'
  if (value === 'SUCCESS') return 'Успешно'
  if (value === 'FAILED') return 'Ошибка'
  return 'Ожидает запуска'
}

function statusClass(value?: string | null) {
  if (value === 'RUNNING') return 'border-cyan-400/25 bg-blue-500/10 text-blue-100'
  if (value === 'SUCCESS') return 'border-emerald-400/25 bg-blue-500/10 text-emerald-100'
  if (value === 'FAILED') return 'border-red-400/25 bg-red-500/10 text-red-100'
  return 'border-white/10 bg-white/[0.04] text-zinc-300'
}

function mainStatusLabel(value?: string | null) {
  if (value === 'RUNNING') return 'Синхронизация идёт'
  if (value === 'SUCCESS') return 'Последний сбор успешен'
  if (value === 'FAILED') return 'Есть ошибка сбора'
  return 'Ожидает первого запуска'
}

function logSummary(log: any) {
  if (!log) return 'Нет запусков'

  const parts = [
    typeof log.itemsDiscovered === 'number' ? `найдено ${log.itemsDiscovered}` : null,
    typeof log.itemsCreated === 'number' ? `новых ${log.itemsCreated}` : null,
    typeof log.itemsUpdated === 'number' ? `обновлено ${log.itemsUpdated}` : null
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : 'Последний сбор завершён'
}

function queueByName(status: any, queueName: string) {
  const queues = Array.isArray(status?.queues) ? status.queues : []
  return queues.find((item: any) => item?.queueName === queueName) || null
}

function effectiveStatus(item: any) {
  if (!item) return 'PENDING'
  if (item.effectiveStatus) return item.effectiveStatus

  const state = item?.bullJob?.state || ''
  if (['active', 'waiting', 'delayed', 'prioritized', 'waiting-children'].includes(state)) return 'RUNNING'
  if (state === 'completed' && item?.latestLog?.jobStatus === 'PENDING') return 'SUCCESS'
  if (state === 'failed' && item?.latestLog?.jobStatus === 'PENDING') return 'FAILED'

  return item?.latestLog?.jobStatus || 'PENDING'
}

export default function CompanySyncStatusCard({ status }: { status: any }) {
  const safeStatus = status || { status: 'PENDING', queues: [], logs: [], lastFailedLog: null, lastSuccessLog: null }
  const reviews = queueByName(safeStatus, 'reviews_sync')
  const web = queueByName(safeStatus, 'mentions_sync')
  const rating = queueByName(safeStatus, 'rating_refresh')

  const rows = [
      {
        title: 'Яндекс Карты',
        description: 'Отзывы и новые оценки',
        item: reviews,
        successLabel: 'успешно'
      },
      {
        title: '2ГИС',
        description: 'Отзывы и новые оценки',
        item: reviews,
        successLabel: 'успешно'
      },
      {
        title: 'WEB',
        description: 'Новые источники и упоминания в сети',
        item: web,
        successLabel: 'успешно',
        href: safeStatus?.companyId ? `/companies/${safeStatus.companyId}/web` : null
      }
    ]

  return (
    <Card className="mt-6 border-cyan-400/15 bg-cyan-500/[0.03] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-brand">Статус синхронизации</div>
          <div className="mt-2 text-sm leading-6 text-zinc-300">
            Последний сбор отзывов и WEB-упоминаний без технических деталей.
          </div>
        </div>

        <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusClass(safeStatus?.status)}`}>
          {mainStatusLabel(safeStatus?.status)}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.map((row) => {
          const state = effectiveStatus(row.item)
          const latestLog = row.item?.latestLog || null
          const label = state === 'SUCCESS' ? row.successLabel : statusLabel(state)

          return (
            <div
              key={row.title}
              className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-brand">{row.title}</div>
                  <div className="mt-1 text-xs text-zinc-300">{row.description}</div>
                </div>

                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(state)}`}>
                  {label}
                </span>
              </div>

              <div className="mt-3 text-xs text-zinc-300">
                <div>Последний сбор: {formatDateTime(latestLog?.createdAt || latestLog?.finishedAt)}</div>
                <div className="mt-1">{state === 'FAILED' ? 'Источник временно недоступен. Повторим позже.' : logSummary(latestLog)}</div>
                  {row.href ? (
                    <a href={row.href} className="mt-3 inline-flex text-xs font-semibold text-blue-100 hover:text-blue-100">
                      Открыть вкладку Сеть →
                    </a>
                  ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
