'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import { getAdminOverview, type AdminOverview } from '@/lib/api/admin'
import { Users, Building2, BriefcaseBusiness, MessageSquareText, TrendingDown, AlertTriangle, Star, Activity } from 'lucide-react'

function fmt(v: number | null | undefined) {
  if (v == null) return '—'
  return new Intl.NumberFormat('ru-RU').format(v)
}

function fmtRating(v: number | null | undefined) {
  if (v == null) return '—'
  return Number(v).toFixed(2)
}

function KpiCard({
  icon: Icon,
  label,
  scope,
  value,
  accent = 'cyan'
}: {
  icon: any
  label: string
  scope: string
  value: string
  accent?: 'cyan' | 'amber' | 'red' | 'emerald' | 'violet'
}) {
  const colors: Record<string, string> = {
    cyan: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200',
    amber: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    red: 'border-red-400/20 bg-red-500/10 text-red-200',
    emerald: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    violet: 'border-violet-400/20 bg-violet-500/10 text-violet-200'
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-zinc-400">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-600">{scope}</div>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${colors[accent]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </Card>
  )
}

export default function OverviewTab() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAdminOverview()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error || 'Нет данных'}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 text-xs uppercase tracking-widest text-zinc-600">Пользователи</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Users} label="Всего" scope={data.users.total.scope} value={fmt(data.users.total.value)} />
          <KpiCard icon={Users} label="Активные" scope={data.users.active.scope} value={fmt(data.users.active.value)} accent="emerald" />
          <KpiCard icon={Users} label="Отключённые" scope={data.users.disabled.scope} value={fmt(data.users.disabled.value)} accent="red" />
          <KpiCard icon={Users} label="Новые" scope={data.users.newLast30d.scope} value={fmt(data.users.newLast30d.value)} accent="violet" />
        </div>
      </div>

      <div>
        <div className="mb-3 text-xs uppercase tracking-widest text-zinc-600">Workspace и компании</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Building2} label="Workspace всего" scope={data.workspaces.total.scope} value={fmt(data.workspaces.total.value)} />
          <KpiCard icon={Building2} label="Workspace активные" scope={data.workspaces.active.scope} value={fmt(data.workspaces.active.value)} accent="emerald" />
          <KpiCard icon={BriefcaseBusiness} label="Компании" scope={data.companies.total.scope} value={fmt(data.companies.total.value)} />
          <KpiCard icon={Star} label="Средний рейтинг" scope={data.averageRating.scope} value={fmtRating(data.averageRating.value)} accent="amber" />
        </div>
      </div>

      <div>
        <div className="mb-3 text-xs uppercase tracking-widest text-zinc-600">Упоминания</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={MessageSquareText} label="Всего" scope={data.mentions.allTime.scope} value={fmt(data.mentions.allTime.value)} />
          <KpiCard icon={MessageSquareText} label="За 30 дней" scope={data.mentions.last30d.scope} value={fmt(data.mentions.last30d.value)} accent="violet" />
          <KpiCard icon={MessageSquareText} label="За 24 часа" scope={data.mentions.last24h.scope} value={fmt(data.mentions.last24h.value)} accent="amber" />
          <KpiCard icon={TrendingDown} label="Негатив 24ч" scope={data.mentions.negativeLast24h.scope} value={fmt(data.mentions.negativeLast24h.value)} accent="red" />
        </div>
      </div>

      <div>
        <div className="mb-3 text-xs uppercase tracking-widest text-zinc-600">Система</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={AlertTriangle} label="Ошибки заданий" scope={data.failedJobsLast24h.scope} value={fmt(data.failedJobsLast24h.value)} accent={data.failedJobsLast24h.value > 0 ? 'red' : 'emerald'} />
        </div>
      </div>
    </div>
  )
}
