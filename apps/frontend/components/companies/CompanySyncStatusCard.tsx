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
  if (value === 'RUNNING') return 'Синхронизация идёт'
  if (value === 'SUCCESS') return 'Последняя синхронизация успешна'
  if (value === 'FAILED') return 'Есть ошибка синхронизации'
  return 'Ожидает запуска'
}

function statusClass(value?: string | null) {
  if (value === 'RUNNING') return 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100'
  if (value === 'SUCCESS') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
  if (value === 'FAILED') return 'border-red-400/25 bg-red-500/10 text-red-100'
  return 'border-white/10 bg-white/[0.04] text-muted'
}

function queueLabel(value?: string | null) {
  if (value === 'reviews_sync') return 'Отзывы'
  if (value === 'mentions_sync') return 'Упоминания'
  if (value === 'rating_refresh') return 'Рейтинг'
  if (value === 'source_discovery') return 'Источники'
  if (value === 'reconcile') return 'Сверка'
  return value || 'Очередь'
}

function logSummary(log: any) {
  if (!log) return 'Нет запусков'

  const parts = [
    typeof log.itemsDiscovered === 'number' ? `найдено ${log.itemsDiscovered}` : null,
    typeof log.itemsCreated === 'number' ? `новых ${log.itemsCreated}` : null,
    typeof log.itemsUpdated === 'number' ? `обновлено ${log.itemsUpdated}` : null
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : log.jobStatus
}

export default function CompanySyncStatusCard({ status }: { status: any }) {
  const queues = Array.isArray(status?.queues) ? status.queues : []
  const logs = Array.isArray(status?.logs) ? status.logs : []
  const latestLog = logs[0] || null
  const failedLog = status?.lastFailedLog || null
  const successLog = status?.lastSuccessLog || null

  return (
    <Card className="mt-6 border-cyan-400/15 bg-cyan-500/[0.03] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-brand">Статус синхронизации</div>
          <div className="mt-2 text-sm leading-6 text-muted">
            Последние фоновые задачи по отзывам, рейтингу и WEB-упоминаниям.
          </div>
        </div>

        <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusClass(status?.status)}`}>
          {statusLabel(status?.status)}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Последний запуск</div>
          <div className="mt-2 text-base font-semibold text-brand">{formatDateTime(latestLog?.createdAt)}</div>
          <div className="mt-1 text-sm text-muted">{latestLog ? queueLabel(latestLog.queueName) : '—'}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Последний успех</div>
          <div className="mt-2 text-base font-semibold text-brand">{formatDateTime(successLog?.createdAt)}</div>
          <div className="mt-1 text-sm text-muted">{logSummary(successLog)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Последняя ошибка</div>
          <div className="mt-2 text-base font-semibold text-brand">{formatDateTime(failedLog?.createdAt)}</div>
          <div className="mt-1 line-clamp-2 text-sm text-muted">{failedLog?.errorMessage || 'Ошибок не найдено'}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {queues.map((item: any) => {
          const state = item?.bullJob?.state || item?.latestLog?.jobStatus || 'NO_DATA'

          return (
            <div
              key={item.queueName}
              className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-brand">{queueLabel(item.queueName)}</div>
                <div className="mt-1 text-xs text-muted">{logSummary(item.latestLog)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                  {state}
                </span>
                <span>{formatDateTime(item.latestLog?.createdAt)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
