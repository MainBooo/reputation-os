'use client'

import Link from 'next/link'
import { Lock, type LucideIcon } from 'lucide-react'
import Card from '@/components/ui/Card'

export type NetworkCardStatus = 'enabled' | 'disabled' | 'locked'

const STATUS_LABEL: Record<NetworkCardStatus, string> = {
  enabled: 'Включён',
  disabled: 'Выключен',
  locked: 'Недоступно'
}

const STATUS_CLASS: Record<NetworkCardStatus, string> = {
  enabled: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  disabled: 'border-white/10 bg-white/[0.04] text-zinc-400',
  locked: 'border-amber-400/25 bg-amber-500/10 text-amber-200'
}

export function formatRuDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function NetworkMonitoringCard({
  icon: Icon,
  title,
  description,
  status,
  toggle,
  lastRunAt,
  mentionsFound,
  stateLabel,
  detailHref,
  detailLabel = 'Подробнее'
}: {
  icon: LucideIcon
  title: string
  description: string
  status: NetworkCardStatus
  toggle: React.ReactNode
  lastRunAt?: string | null
  mentionsFound?: number
  stateLabel: string
  detailHref?: string
  detailLabel?: string
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 max-w-md text-xs leading-5 text-zinc-500">{description}</p>
          </div>
        </div>

        <span
          className={[
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
            STATUS_CLASS[status]
          ].join(' ')}
        >
          {status === 'locked' ? <Lock className="h-3 w-3" /> : null}
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
        {toggle}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Последний запуск" value={formatRuDateTime(lastRunAt)} />
        <Stat label="Найдено упоминаний" value={String(mentionsFound ?? 0)} />
        <Stat label="Состояние поиска" value={stateLabel} />
      </div>

      {detailHref ? (
        <div className="mt-4">
          <Link href={detailHref} className="text-xs font-medium text-cyan-400 underline-offset-2 hover:underline">
            {detailLabel} →
          </Link>
        </div>
      ) : null}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-white" title={value}>
        {value}
      </div>
    </div>
  )
}
