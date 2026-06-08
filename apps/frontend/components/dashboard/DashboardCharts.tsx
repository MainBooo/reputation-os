'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import Card from '@/components/ui/Card'

type TrendPoint = {
  date?: string
  label: string
  value: number
  rawValue?: number
}

type RatingPoint = {
  date?: string
  label: string
  value: number
  rawValue?: number
}

type PlatformPoint = {
  platform: string
  count: number
}

type SentimentPoint = {
  name: string
  value: number
  color: string
}

type DashboardChartsProps = {
  mentionTrend: TrendPoint[]
  ratingTrend: RatingPoint[]
  platforms: PlatformPoint[]
  sentiment: {
    positive: number
    neutral: number
    negative: number
  }
  totalMentions: number
  averageRating: number | null
}

const SENTIMENT_COLORS = {
  positive: '#34d399',
  neutral: '#fbbf24',
  negative: '#f87171'
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b111b]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur">
      <div className="text-xs text-zinc-300">{label}</div>
      <div className="mt-1 text-sm font-semibold text-brand">
        {formatNumber(Number(payload[0]?.value || 0))}
      </div>
    </div>
  )
}

function MentionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload || {}
  const value = Number(point.rawValue ?? payload[0]?.value ?? 0)

  return (
    <div className="rounded-2xl border border-violet-400/40 bg-[#08111c]/95 px-3.5 py-3 shadow-2xl backdrop-blur">
      <div className="text-xs text-slate-400">{point.label || label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-blue-100">
        <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
        Упоминаний: {formatNumber(value)}
      </div>
    </div>
  )
}

function RatingTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload || {}
  const value = Number(point.rawValue ?? payload[0]?.value ?? 0)

  return (
    <div className="rounded-2xl border border-violet-400/40 bg-[#08140f]/95 px-3.5 py-3 shadow-2xl backdrop-blur">
      <div className="text-xs text-slate-400">{point.label || label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-100">
        <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
        Рейтинг: {value.toFixed(1)} ★
      </div>
    </div>
  )
}

function getSentimentData(sentiment: DashboardChartsProps['sentiment']): SentimentPoint[] {
  return [
    { name: 'Позитивные', value: sentiment.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Нейтральные', value: sentiment.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Негативные', value: sentiment.negative, color: SENTIMENT_COLORS.negative }
  ].filter((item) => item.value > 0)
}

function getSentimentPercent(value: number, total: number) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

export default function DashboardCharts({
  mentionTrend,
  ratingTrend,
  platforms,
  sentiment,
  totalMentions,
  averageRating
}: DashboardChartsProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const sentimentData = getSentimentData(sentiment)
  const sentimentTotal = Math.max(sentiment.positive + sentiment.neutral + sentiment.negative, totalMentions, 0)

  const yMax = useMemo(() => {
    const maxValue = Math.max(...mentionTrend.map((item) => Number(item.value || 0)), 1)
    return Math.max(5, Math.ceil(maxValue * 1.18))
  }, [mentionTrend])

  if (!mounted) {
    return (
      <div className="grid min-w-0 gap-5">
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden rounded-[26px] border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_34px_rgba(59,130,246,0.08)] sm:p-6">
            <div className="h-6 w-56 rounded-full bg-white/[0.06]" />
            <div className="mt-3 h-4 w-36 rounded-full bg-white/[0.04]" />
            <div className="mt-4 h-[180px] rounded-2xl bg-white/[0.035] sm:h-[220px]" />
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-[26px] border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_34px_rgba(59,130,246,0.08)] sm:p-6">
            <div className="h-6 w-36 rounded-full bg-white/[0.06]" />
            <div className="mt-3 h-4 w-48 rounded-full bg-white/[0.04]" />
            <div className="mt-4 h-[180px] rounded-2xl bg-white/[0.035] sm:h-[220px]" />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden rounded-[26px] border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_34px_rgba(59,130,246,0.08)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold tracking-[-0.03em] text-white">Динамика упоминаний</div>
              <div className="mt-2 text-sm text-slate-400">Количество новых упоминаний по дням</div>
            </div>

            <div className="rounded-full border border-violet-400/40 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-100">
              {formatNumber(totalMentions)}
            </div>
          </div>

          <div className="mt-6 h-[260px] min-h-[260px] min-w-0 sm:h-[300px] sm:min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={mentionTrend} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="mentionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.34} />
                    <stop offset="58%" stopColor="#0ea5e9" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke="rgba(255,255,255,0.075)" strokeDasharray="4 8" vertical={false} />

                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    mentionTrend.find((item) => item.date === value)?.label || String(value)
                  }
                  tick={{ fill: 'rgba(226,232,240,0.58)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(148,163,184,0.18)' }}
                  tickLine={false}
                  minTickGap={24}
                />

                <YAxis
                  width={34}
                  domain={[0, yMax]}
                  allowDecimals={false}
                  tick={{ fill: 'rgba(226,232,240,0.58)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(148,163,184,0.18)' }}
                  tickLine={false}
                />

                <Tooltip
                  content={<MentionTooltip />}
                  cursor={{ stroke: 'rgba(34,211,238,0.35)', strokeDasharray: '4 6' }}
                />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  fill="url(#mentionsGradient)"
                  fillOpacity={1}
                  dot={{ r: 3, stroke: '#e0faff', strokeWidth: 1.5, fill: '#0ea5e9' }}
                  activeDot={{ r: 7, stroke: '#e0faff', strokeWidth: 3, fill: '#0ea5e9' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs leading-5 text-slate-400">
            График показывает новые упоминания по дням. Линия сглажена для читаемости, в подсказке отображается фактическое количество.
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-[26px] border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_34px_rgba(59,130,246,0.08)] sm:p-6">
          <div>
            <div className="text-xl font-semibold tracking-[-0.03em] text-white">Тональность</div>
            <div className="mt-2 text-sm text-slate-400">Позитив / нейтральные / негатив</div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-[230px_1fr] sm:items-center">
            <div className="relative mx-auto h-[190px] min-h-[190px] w-full max-w-[220px] min-w-0 sm:h-[230px] sm:min-h-[230px] sm:max-w-none">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={sentimentData.length ? sentimentData : [{ name: 'Нет данных', value: 1, color: 'rgba(255,255,255,0.12)' }]}
                    dataKey="value"
                    innerRadius={54}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="rgba(0,0,0,0)"
                  >
                    {(sentimentData.length ? sentimentData : [{ color: 'rgba(255,255,255,0.12)' }]).map((entry, index) => (
                      <Cell key={`sentiment-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">{formatNumber(totalMentions)}</div>
                <div className="text-xs text-zinc-300">упоминаний</div>
              </div>
            </div>

            <div className="space-y-3 sm:pl-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-zinc-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Позитивные
                </span>
                <span className="text-brand">
                  {getSentimentPercent(sentiment.positive, sentimentTotal)}% ({formatNumber(sentiment.positive)})
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-zinc-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  Нейтральные
                </span>
                <span className="text-brand">
                  {getSentimentPercent(sentiment.neutral, sentimentTotal)}% ({formatNumber(sentiment.neutral)})
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-zinc-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  Негативные
                </span>
                <span className="text-brand">
                  {getSentimentPercent(sentiment.negative, sentimentTotal)}% ({formatNumber(sentiment.negative)})
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden rounded-[26px] border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_34px_rgba(59,130,246,0.08)] sm:p-6">
          <div>
            <div className="text-xl font-semibold tracking-[-0.03em] text-white">Источники</div>
            <div className="mt-2 text-sm text-slate-400">Распределение упоминаний по площадкам</div>
          </div>

          <div className="mt-4 h-[180px] min-h-[180px] min-w-0 sm:h-[220px] sm:min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={platforms} layout="vertical" margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'rgba(226,232,240,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="platform"
                  width={76}
                  tick={{ fill: 'rgba(226,232,240,0.82)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="count" radius={[0, 10, 10, 0]} fill="#38bdf8" barSize={16}>
                  {platforms.map((_, index) => (
                    <Cell
                      key={`platform-${index}`}
                      fill={index === 0 ? '#38bdf8' : index === 1 ? '#60a5fa' : index === 2 ? '#34d399' : '#fbbf24'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-[26px] border-white/10 bg-[#0b111c]/92 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_34px_rgba(59,130,246,0.08)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold tracking-[-0.03em] text-white">Динамика рейтинга</div>
              <div className="mt-2 text-sm text-slate-400">По отзывам с оценками</div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-semibold text-brand">
                {averageRating === null ? '—' : `${averageRating.toFixed(1)} ★`}
              </div>
              <div className="text-xs text-emerald-300">актуально</div>
            </div>
          </div>

          <div className="mt-4 h-[180px] min-h-[180px] min-w-0 sm:h-[220px] sm:min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={ratingTrend} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.34} />
                    <stop offset="60%" stopColor="#34d399" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke="rgba(255,255,255,0.075)" strokeDasharray="4 8" vertical={false} />

                <XAxis
                  dataKey="date"
                  tickFormatter={(_, index) => ratingTrend[index]?.label || ''}
                  tick={{ fill: 'rgba(226,232,240,0.58)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(148,163,184,0.18)' }}
                  tickLine={false}
                  minTickGap={24}
                />

                <YAxis
                  width={34}
                  domain={[1, 5]}
                  tick={{ fill: 'rgba(226,232,240,0.58)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(148,163,184,0.18)' }}
                  tickLine={false}
                  ticks={[1, 2, 3, 4, 5]}
                />

                <Tooltip
                  content={<RatingTooltip />}
                  cursor={{ stroke: 'rgba(52,211,153,0.35)', strokeDasharray: '4 6' }}
                />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#34d399"
                  strokeWidth={3}
                  fill="url(#ratingGradient)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 7, stroke: '#dcfce7', strokeWidth: 3, fill: '#34d399' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
