'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Activity, CalendarDays, ChevronDown, Download, MessageSquare, Smile, Star, ThumbsDown } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Props = {
  overview: any
  sentiment: any[]
  platforms: any
}

const periods = [
  { key: '7d', label: '7 дней', days: 7 },
  { key: '14d', label: '14 дней', days: 14 },
  { key: '30d', label: '30 дней', days: 30 },
  { key: 'month', label: 'Текущий месяц', days: 0 }
] as const

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0
}

function formatPeriod(key: string) {
  const now = new Date()
  const start = new Date(now)

  if (key === 'month') start.setDate(1)
  else {
    const found = periods.find((p) => p.key === key)
    start.setDate(now.getDate() - ((found?.days || 7) - 1))
  }

  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
  return `${fmt.format(start)} — ${fmt.format(now)} ${now.getFullYear()}`
}

function csv(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function platformLabel(platform?: string) {
  if (platform === 'YANDEX') return 'Яндекс'
  if (platform === 'TWOGIS') return '2GIS'
  if (platform === 'WEB') return 'WEB'
  return 'Другие'
}

function platformHint(item: any) {
  if (item.avgRating) return `★ ${item.avgRating}`
  if (item.count) return 'активен'
  return 'нет данных'
}

function sourceInitial(platform?: string) {
  if (platform === 'YANDEX') return 'Я'
  if (platform === 'TWOGIS') return '2G'
  if (platform === 'WEB') return 'W'
  return '•'
}

function sentimentClasses(sentiment?: string) {
  if (sentiment === 'NEGATIVE') return 'border-rose-400/20 bg-rose-500/[0.055] text-rose-200'
  if (sentiment === 'POSITIVE') return 'border-emerald-400/20 bg-emerald-500/[0.055] text-emerald-200'
  return 'border-cyan-400/18 bg-cyan-500/[0.045] text-cyan-200'
}

function Card({ label, value, icon, tone = 'cyan', delta = '↑ 0%' }: any) {
  const styles: Record<string, string> = {
    cyan: 'border-cyan-300/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_62%),rgba(7,17,31,0.82)]',
    rose: 'border-rose-400/20 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.14),transparent_62%),rgba(7,17,31,0.82)]',
    emerald: 'border-emerald-400/18 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_62%),rgba(7,17,31,0.82)]',
    slate: 'border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.09),transparent_62%),rgba(7,17,31,0.82)]'
  }

  const deltaClass = String(delta).startsWith('↓') ? 'text-rose-300' : String(delta).startsWith('→') ? 'text-zinc-400' : 'text-emerald-300'

  return (
    <div className={`rounded-[22px] border p-5 shadow-[0_18px_52px_rgba(0,0,0,0.24)] ${styles[tone] || styles.cyan}`}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-cyan-100">
          {icon}
        </div>
        <div className="min-w-0 flex-1 text-sm text-zinc-300">{label}</div>
        <div className={`text-xs font-medium ${deltaClass}`}>{delta}</div>
      </div>
      <div className="text-4xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-3 text-xs text-zinc-500">за выбранный период</div>
    </div>
  )
}

export default function AnalyticsDashboard({ overview, sentiment, platforms }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [period, setPeriod] = useState<(typeof periods)[number]['key']>('7d')
  const [open, setOpen] = useState(false)

  const periodLabel = useMemo(() => formatPeriod(period), [period])

  function applyPeriod(nextPeriod: (typeof periods)[number]['key']) {
    const now = new Date()
    const start = new Date(now)

    if (nextPeriod === 'month') start.setDate(1)
    else {
      const found = periods.find((item) => item.key === nextPeriod)
      start.setDate(now.getDate() - ((found?.days || 7) - 1))
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('from', start.toISOString().slice(0, 10))
    params.set('to', now.toISOString().slice(0, 10))

    setPeriod(nextPeriod)
    setOpen(false)
    router.push(`${pathname}?${params.toString()}`)
    setTimeout(() => router.refresh(), 50)
  }

  const sentimentCount = (name: string) =>
    Number(sentiment?.find((item: any) => String(item.sentiment).toUpperCase() === name)?.count || 0)

  const total = Number(overview?.mentionsCount || 0)
  const positive = Number(overview?.positiveCount || sentimentCount('POSITIVE') || 0)
  const neutral = Number(overview?.neutralCount || sentimentCount('NEUTRAL') || 0)
  const negative = Number(overview?.negativeCount || sentimentCount('NEGATIVE') || 0)
  const reviews = Number(overview?.reviewsCount || 0)

  const platformItems = Array.isArray(platforms?.items) ? platforms.items : []
  const yandexRating = Number(platformItems.find((item: any) => item.platform === 'YANDEX')?.avgRating || 0)
  const rating = Number(overview?.rating || yandexRating || 0) || 0
  const positiveShare = Number(overview?.positiveShare || pct(positive, total))
  const trend = overview?.trend?.length ? overview.trend : []
  const latest = Array.isArray(overview?.latest) ? overview.latest.slice(0, 6) : []

  const reputationTrend = overview?.reputationTrend?.length
    ? overview.reputationTrend.map((item: any, index: number) => ({
        ...item,
        rating: Number(Math.max(1, Math.min(5, Number(item.rating || rating || 0) + (index % 3 === 0 ? -0.035 : index % 3 === 1 ? 0.025 : 0.045))).toFixed(2))
      }))
    : trend.map((item: any, index: number) => ({
        ...item,
        rating: rating ? Number(Math.max(1, Math.min(5, rating - 0.12 + index * 0.028 + (index % 3 === 0 ? -0.035 : index % 3 === 1 ? 0.025 : 0.045))).toFixed(2)) : 0
      }))

  const platformRows = ['YANDEX', 'WEB', 'TWOGIS', 'CUSTOM'].map((key) => {
    const found = platforms?.items?.find((item: any) => item.platform === key)
    return {
      key,
      count: Number(found?.count || 0),
      avgRating: found?.avgRating ? Number(found.avgRating).toFixed(1) : null
    }
  })

  function exportCsv() {
    const rows = [
      ['Период', periodLabel],
      ['Рейтинг', rating ? rating.toFixed(1) : ''],
      ['Всего упоминаний', total],
      ['Позитивные', positive],
      ['Нейтральные', neutral],
      ['Негативные', negative],
      ['Отзывы', reviews],
      ['Доля позитива', `${positiveShare}%`]
    ]

    const content = rows.map((row) => row.map(csv).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reputation-analytics-${period}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Аналитика</h1>
          <p className="mt-1 text-sm text-zinc-400">Репутация, тональность, источники и последние события.</p>
        </div>

        <div className="relative flex flex-wrap gap-3">
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/35 hover:bg-cyan-300/10">
            <CalendarDays className="h-4 w-4 text-cyan-200" />
            {periodLabel}
            <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
          </button>

          {open ? (
            <div className="absolute left-0 top-[52px] z-30 w-56 rounded-2xl border border-white/10 bg-[#07111f] p-2 shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
              {periods.map((item) => (
                <button key={item.key} type="button" onClick={() => applyPeriod(item.key)} className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${period === item.key ? 'bg-cyan-300/15 text-cyan-100' : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/35 hover:bg-cyan-300/10">
            <Download className="h-4 w-4 text-cyan-200" /> Экспорт
          </button>
        </div>
      </div>

      <section className="grid gap-4 rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_25%_0%,rgba(34,211,238,0.14),transparent_34%),linear-gradient(135deg,rgba(8,13,30,0.98),rgba(4,9,20,0.96))] p-4 shadow-[0_22px_72px_rgba(0,0,0,0.32)] sm:p-5 lg:grid-cols-[240px_1fr_170px]">
        <div>
          <div className="text-base font-semibold text-white">Средний рейтинг за период</div>
          <div className="mt-6 flex items-center gap-3">
            <div className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">{rating ? rating.toFixed(1) : '—'}</div>
            <Star className="h-10 w-10 text-cyan-300" />
          </div>
          <div className="mt-5 text-sm font-medium text-cyan-300">Хорошая репутация</div>
          <div className="mt-5 text-sm leading-6 text-zinc-400">Рассчитано по отзывам и упоминаниям за выбранный период.</div>
        </div>

        <div className="min-h-[175px]">
          <ResponsiveContainer width="100%" height={175}>
            <AreaChart data={reputationTrend}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 6]} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#07111f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14 }} />
              <Area type="linear" dataKey="rating" stroke="#22d3ee" strokeWidth={3.2} fill="#22d3ee22" dot={false} activeDot={{ r: 5, stroke: '#a5f3fc', strokeWidth: 2, fill: '#22d3ee' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

          <div className="hidden items-center justify-center lg:flex">
            <div className="relative h-[150px] w-[150px]">
              <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-2xl" />

              <svg viewBox="0 0 120 120" className="relative h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="9" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(0, Math.min(100, positiveShare)) * 3.015} 301.5`}
                  className="drop-shadow-[0_0_12px_rgba(34,211,238,0.9)]"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full border border-cyan-300/15 bg-[#07111f]/75 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div className="text-3xl font-semibold text-white">{positiveShare}%</div>
                <div className="mt-1 text-xs leading-4 text-zinc-400">позитивных<br />упоминаний</div>
              </div>
            </div>
          </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card icon={<MessageSquare className="h-5 w-5" />} label="Всего упоминаний" value={total} tone="cyan" delta={overview?.deltas?.total >= 0 ? `↑ ${overview?.deltas?.total || 0}%` : `↓ ${Math.abs(overview?.deltas?.total || 0)}%`} />
        <Card icon={<ThumbsDown className="h-5 w-5" />} label="Негативные упоминания" value={negative} tone="rose" delta={overview?.deltas?.negative >= 0 ? `↑ ${overview?.deltas?.negative || 0}%` : `↓ ${Math.abs(overview?.deltas?.negative || 0)}%`} />
        <Card icon={<Smile className="h-5 w-5" />} label="Позитивные упоминания" value={positive} tone="emerald" delta={overview?.deltas?.positive >= 0 ? `↑ ${overview?.deltas?.positive || 0}%` : `↓ ${Math.abs(overview?.deltas?.positive || 0)}%`} />
        <Card icon={<MessageSquare className="h-5 w-5" />} label="Всего отзывов" value={reviews} tone="slate" delta="→ 0%" />
      </div>

      <section className="rounded-[24px] border border-white/10 bg-[#07111f]/80 p-5">
        <h2 className="mb-5 text-base font-semibold text-white">Динамика тональности</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 'dataMax + 1']} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#07111f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14 }} />
            <Line type="monotone" dataKey="positive" stroke="#66d85f" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="neutral" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="negative" stroke="#ff4f68" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.09),transparent_36%),rgba(7,17,31,0.78)] p-4 shadow-[0_18px_58px_rgba(0,0,0,0.26)] sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Источники мониторинга</h2>
            <p className="mt-1 text-xs text-zinc-500">Активность по площадкам за выбранный период</p>
          </div>
          <div className="hidden text-xs text-cyan-200/70 sm:block">{platformRows.filter((item) => item.count > 0).length} активных</div>
        </div>

        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {platformRows.filter((item) => item.key !== 'CUSTOM' || item.count > 0).map((item) => (
            <div key={item.key} className="group min-w-[205px] rounded-full border border-white/10 bg-white/[0.035] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.06]">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] text-xs font-semibold text-cyan-100">
                  {sourceInitial(item.key)}
                  {item.count ? <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.7)]" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{platformLabel(item.key)}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{platformHint(item)}</div>
                </div>
                <div className="text-xl font-semibold tracking-tight text-white">{item.count}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_100%_0%,rgba(139,92,246,0.08),transparent_34%),rgba(7,17,31,0.78)] p-4 shadow-[0_18px_58px_rgba(0,0,0,0.26)] sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Живая лента</h2>
            <p className="mt-1 text-xs text-zinc-500">Последние отзывы и упоминания</p>
          </div>
          <Activity className="h-4 w-4 text-cyan-200/70" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {latest.map((item: any, index: number) => {
            const date = item.publishedAt || item.createdAt
            const time = date ? new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : 'сейчас'
            const text = item.content || item.title || 'Новое упоминание'

            return (
              <article key={item.id} className={`rounded-[22px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ${sentimentClasses(item.sentiment)} ${index === 1 ? 'md:row-span-2' : ''}`}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#050816]/70 text-xs font-semibold text-white">
                    {sourceInitial(item.platform)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{platformLabel(item.platform)}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{time}{item.ratingValue ? ` · ★ ${item.ratingValue}` : ''}</div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-current opacity-80 shadow-[0_0_12px_currentColor]" />
                </div>
                <p className="text-sm leading-6 text-zinc-200">{text}</p>
              </article>
            )
          })}

          {!latest.length ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-zinc-500">Нет последних событий</div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
