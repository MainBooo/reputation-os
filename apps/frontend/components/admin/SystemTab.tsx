'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { getSystemHealth, type SystemHealth } from '@/lib/api/admin'
import { CheckCircle2, XCircle, HelpCircle, AlertTriangle, RefreshCw } from 'lucide-react'

function StatusIcon({ status }: { status: string }) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  if (status === 'error') return <XCircle className="h-4 w-4 text-red-400" />
  if (status === 'degraded') return <AlertTriangle className="h-4 w-4 text-amber-400" />
  return <HelpCircle className="h-4 w-4 text-zinc-500" />
}

function StatusLabel({ status }: { status: string }) {
  if (status === 'ok') return <span className="text-xs font-medium text-emerald-400">OK</span>
  if (status === 'error') return <span className="text-xs font-medium text-red-400">Ошибка</span>
  if (status === 'degraded') return <span className="text-xs font-medium text-amber-400">Деградация</span>
  return <span className="text-xs font-medium text-zinc-500">Неизвестно</span>
}

function ServiceCard({ title, status, reason, children }: { title: string; status: string; reason?: string; children?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <StatusIcon status={status} />
          <span className="text-sm font-medium text-white">{title}</span>
        </div>
        <StatusLabel status={status} />
      </div>
      {reason && <div className="text-xs text-zinc-500 mt-1">{reason}</div>}
      {children}
    </Card>
  )
}

const QUEUE_LABELS: Record<string, string> = {
  source_discovery: 'Source Discovery',
  reviews_sync: 'Reviews Sync',
  mentions_sync: 'Mentions Sync',
  rating_refresh: 'Rating Refresh',
  reconcile: 'Reconcile',
  notifications: 'Notifications',
  page_watch: 'Page Watch'
}

export default function SystemTab() {
  const [data, setData] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await getSystemHealth()
      setData(res)
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error || 'Нет данных'}</div>
        <Button onClick={load} variant="secondary" className="gap-2"><RefreshCw className="h-4 w-4" /> Обновить</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={load} variant="secondary" className="gap-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Обновить
        </Button>
      </div>

      <div>
        <div className="mb-3 text-xs uppercase tracking-widest text-zinc-600">Сервисы</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ServiceCard title="API" status={data.api.status} />
          <ServiceCard title="PostgreSQL" status={data.database.status} reason={data.database.reason} />
          <ServiceCard title="Redis" status={data.redis.status} reason={data.redis.reason} />
          <ServiceCard title="Worker" status={data.worker.status} reason={data.worker.reason}>
            {data.worker.lastHeartbeatAgo !== undefined && (
              <div className="mt-1 text-xs text-zinc-500">Heartbeat: {data.worker.lastHeartbeatAgo}с назад</div>
            )}
          </ServiceCard>
          <ServiceCard title="Telegram Bot" status={data.telegram.status} reason={data.telegram.reason} />
          <ServiceCard title="Push Notifications" status={data.push.status} reason={data.push.reason} />
        </div>
      </div>

      <div>
        <div className="mb-3 text-xs uppercase tracking-widest text-zinc-600">BullMQ Очереди</div>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Очередь</th>
                <th className="px-5 py-3 text-center">Статус</th>
                <th className="px-5 py-3 text-center">Waiting</th>
                <th className="px-5 py-3 text-center">Active</th>
                <th className="px-5 py-3 text-center">Failed</th>
                <th className="px-5 py-3 text-center">Delayed</th>
                <th className="px-5 py-3 text-center">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {Object.entries(data.queues).map(([name, q]) => (
                <tr key={name} className="text-zinc-300">
                  <td className="px-5 py-3 text-white">{QUEUE_LABELS[name] || name}</td>
                  <td className="px-5 py-3 text-center"><StatusIcon status={q.status} /></td>
                  <td className="px-5 py-3 text-center text-xs">{q.waiting ?? '—'}</td>
                  <td className="px-5 py-3 text-center text-xs">{q.active ?? '—'}</td>
                  <td className={`px-5 py-3 text-center text-xs ${(q.failed ?? 0) > 0 ? 'text-red-400 font-semibold' : ''}`}>{q.failed ?? '—'}</td>
                  <td className="px-5 py-3 text-center text-xs">{q.delayed ?? '—'}</td>
                  <td className="px-5 py-3 text-center text-xs text-zinc-600">{q.completed ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div>
        <div className="mb-3 text-xs uppercase tracking-widest text-zinc-600">Прочее</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <div className="text-xs text-zinc-500 mb-1">Ошибок заданий за 24ч</div>
            <div className={`text-2xl font-semibold ${data.failedJobs.count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {data.failedJobs.count}
            </div>
            <div className="text-xs text-zinc-700 mt-1">за {data.failedJobs.window}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-zinc-500 mb-1">Последняя синхронизация</div>
            {data.lastSync.lastSyncedAt ? (
              <>
                <div className="text-sm font-medium text-white">{new Date(data.lastSync.lastSyncedAt).toLocaleString('ru-RU')}</div>
                {data.lastSync.company && <div className="text-xs text-zinc-600 mt-1">{data.lastSync.company}</div>}
              </>
            ) : (
              <div className="text-sm text-zinc-600">Нет данных</div>
            )}
            {data.lastSync.lastJobAt && (
              <div className="mt-2 border-t border-white/[0.06] pt-2 text-xs text-zinc-500">
                Последний job: {new Date(data.lastSync.lastJobAt).toLocaleString('ru-RU')}
                {data.lastSync.lastJobQueue && <span className="ml-1 text-zinc-700">· {data.lastSync.lastJobQueue}</span>}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
