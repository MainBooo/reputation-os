'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import Card from '@/components/ui/Card'

type TrendPoint = {
  label: string
  value: number
}

type RatingPoint = {
  label: string
  value: number
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
    <div className="rounded-xl border border-white/10 bg-[#10151f]/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-brand">
        {formatNumber(Number(payload[0]?.value || 0))}
      </div>
    </div>
  )
}

function RatingTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const value = Number(payload[0]?.value || 0)

  return (
    <div className="rounded-xl border border-white/10 bg-[#10151f]/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-brand">{value.toFixed(1)} ★</div>
    </div>
  )
}

function getSentimentData(sentiment: DashboardChartsProps['sentiment']): SentimentPoint[] {
  return [
    {
      name: 'Позитивные',
      value: sentiment.positive,
      color: SENTIMENT_COLORS.positive
    },
    {
      name: 'Нейтральные',
      value: sentiment.neutral,
      color: SENTIMENT_COLORS.neutral
    },
    {
      name: 'Негативные',
      value: sentiment.negative,
      color: SENTIMENT_COLORS.negative
    }
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
  const sentimentTotal = Math.max(
    sentiment.positive + sentiment.neutral + sentiment.negative,
    totalMentions,
    0
  )

  if (!mounted) {
    return (
      <div className="grid min-w-0 gap-4">
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
            <div className="h-6 w-56 rounded-full bg-white/[0.06]" />
            <div className="mt-3 h-4 w-36 rounded-full bg-white/[0.04]" />
            <div className="mt-4 h-[180px] rounded-2xl bg-white/[0.035] sm:h-[220px]" />
          </Card>

          <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
            <div className="h-6 w-36 rounded-full bg-white/[0.06]" />
            <div className="mt-3 h-4 w-48 rounded-full bg-white/[0.04]" />
            <div className="mt-4 h-[180px] rounded-2xl bg-white/[0.035] sm:h-[220px]" />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-brand">Динамика упоминаний</div>
              <div className="mt-1 text-sm text-muted">За последние 30 дней</div>
            </div>

            <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              {formatNumber(totalMentions)}
            </div>
          </div>

          <div className="mt-4 h-[180px] min-h-[180px] min-w-0 sm:h-[220px] sm:min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={mentionTrend} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'rgba(226,232,240,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                />
                <YAxis
                  tick={{ fill: 'rgba(226,232,240,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(34,211,238,0.25)' }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#22d3ee"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, stroke: '#e0faff', strokeWidth: 2, fill: '#22d3ee' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
          <div>
            <div className="text-lg font-semibold text-brand">Тональность</div>
            <div className="mt-1 text-sm text-muted">Позитив / нейтральные / негатив</div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <div className="relative h-[160px] min-h-[160px] min-w-0 sm:h-[180px] sm:min-h-[180px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={sentimentData.length ? sentimentData : [{ name: 'Нет данных', value: 1, color: 'rgba(255,255,255,0.12)' }]}
                    dataKey="value"
                    innerRadius={54}
                    outerRadius={78}
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
                <div className="text-3xl font-semibold text-brand">{formatNumber(totalMentions)}</div>
                <div className="text-xs text-muted">упоминаний</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-muted">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Позитивные
                </span>
                <span className="text-brand">
                  {getSentimentPercent(sentiment.positive, sentimentTotal)}% ({formatNumber(sentiment.positive)})
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-muted">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  Нейтральные
                </span>
                <span className="text-brand">
                  {getSentimentPercent(sentiment.neutral, sentimentTotal)}% ({formatNumber(sentiment.neutral)})
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-muted">
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

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
          <div>
            <div className="text-lg font-semibold text-brand">Источники</div>
            <div className="mt-1 text-sm text-muted">Распределение упоминаний по площадкам</div>
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

        <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-brand">Динамика рейтинга</div>
              <div className="mt-1 text-sm text-muted">По отзывам с оценками</div>
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
              <LineChart data={ratingTrend} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'rgba(226,232,240,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                />
                <YAxis
                  domain={[1, 5]}
                  tick={{ fill: 'rgba(226,232,240,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  ticks={[1, 2, 3, 4, 5]}
                />
                <Tooltip content={<RatingTooltip />} cursor={{ stroke: 'rgba(74,222,128,0.25)' }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4ade80"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, stroke: '#dcfce7', strokeWidth: 2, fill: '#4ade80' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
