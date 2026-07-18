'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import { getCompany } from '@/lib/api/companies'
import { getTelegramScoutStatus, type TelegramScoutStatus } from '@/lib/api/telegram-channels'
import TelegramMonitoringToggle from './TelegramMonitoringToggle'
import TelegramManualSyncButton from './TelegramManualSyncButton'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'Успешно',
  PARTIAL: 'Частично',
  FAILED: 'Ошибка',
  PENDING: 'Ожидание',
  RUNNING: 'Выполняется'
}

export default function TelegramScoutPanel({ companyId }: { companyId: string }) {
  const [status, setStatus] = useState<TelegramScoutStatus | null>(null)
  const [aliases, setAliases] = useState<Array<{ value: string; isExcluded: boolean }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([getTelegramScoutStatus(companyId), getCompany(companyId)])
      .then(([scoutStatus, company]: [TelegramScoutStatus, any]) => {
        if (cancelled) return
        setStatus(scoutStatus)
        setAliases((company?.aliases || []).map((a: any) => ({ value: a.value, isExcluded: a.isExcluded })))
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [companyId])

  const result = (status?.latestLog?.result || {}) as Record<string, unknown>
  const jobStatus = status?.latestLog?.jobStatus
  const includedAliases = aliases.filter((a) => !a.isExcluded)
  const excludedAliases = aliases.filter((a) => a.isExcluded)

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Telegram Scout</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Ищет упоминания компании в публичных Telegram-каналах, группах и супергруппах.
          </p>
        </div>
        <TelegramMonitoringToggle companyId={companyId} />
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-zinc-500">Загрузка…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Статус последнего запуска" value={jobStatus ? STATUS_LABEL[jobStatus] || jobStatus : '—'} />
            <Stat label="Дата последнего запуска" value={formatDate(status?.latestLog?.finishedAt || status?.latestLog?.startedAt)} />
            <Stat label="Найдено сообщений" value={String(result.messagesScanned ?? '—')} />
            <Stat label="Подтверждено" value={String(result.mentionsConfirmed ?? '—')} />
            <Stat label="Отсеяно" value={String(result.mentionsRejected ?? '—')} />
            <Stat label="Новых каналов" value={String(result.newChannelsFound ?? '—')} />
            <Stat label="Новых групп" value={String(result.newGroupsFound ?? '—')} />
            <Stat label="Размер watchlist" value={`${status?.watchlistEnabledCount ?? 0} / ${status?.watchlistTotalCount ?? 0}`} />
          </div>

          {status?.latestLog?.errorMessage ? (
            <div className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              Последняя ошибка: {status.latestLog.errorMessage}
            </div>
          ) : null}

          {result.reason === 'flood_wait' || (result as any).floodWaitSeconds ? (
            <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Telegram временно ограничил запросы (FloodWait). Часть источников будет проверена в следующем цикле.
            </div>
          ) : null}

          {includedAliases.length || excludedAliases.length ? (
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              {includedAliases.length ? (
                <div>
                  <div className="mb-1 text-zinc-500">Используемые алиасы</div>
                  <div className="flex flex-wrap gap-1.5">
                    {includedAliases.map((a) => (
                      <span key={a.value} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-zinc-300">
                        {a.value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {excludedAliases.length ? (
                <div>
                  <div className="mb-1 text-zinc-500">Исключающие слова</div>
                  <div className="flex flex-wrap gap-1.5">
                    {excludedAliases.map((a) => (
                      <span key={a.value} className="rounded-full border border-red-400/20 bg-red-500/5 px-2 py-0.5 text-red-300">
                        {a.value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between">
            <TelegramManualSyncButton companyId={companyId} />
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
            Telegram Scout не индексирует весь Telegram целиком — покрытие зависит от поисковой выдачи Telegram, лимитов
            запросов и доступности источников. Приватные каналы и группы недоступны.
          </div>
        </>
      )}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}
