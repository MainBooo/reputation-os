import { AlertTriangle, Loader2, SearchX, ShieldCheck } from 'lucide-react'
import Card from './Card'

type PageStateTone = 'empty' | 'error' | 'loading' | 'success'

type PageStateProps = {
  title: string
  description?: string
  tone?: PageStateTone
  action?: React.ReactNode
}

export default function PageState({
  title,
  description,
  tone = 'empty',
  action
}: PageStateProps) {
  const Icon =
    tone === 'error'
      ? AlertTriangle
      : tone === 'loading'
        ? Loader2
        : tone === 'success'
          ? ShieldCheck
          : SearchX

  const toneClass = {
    empty: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200',
    error: 'border-red-400/25 bg-red-500/10 text-red-200',
    loading: 'border-violet-400/25 bg-violet-500/10 text-violet-200',
    success: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
  }[tone]

  return (
    <Card className="overflow-hidden rounded-[28px] border-white/10 bg-[#0b111c]/92 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.34)]">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneClass}`}>
          <Icon className={`h-5 w-5 ${tone === 'loading' ? 'animate-spin' : ''}`} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-white">{title}</div>
          {description ? (
            <div className="mt-1 text-sm leading-6 text-slate-400">{description}</div>
          ) : null}
        </div>

        {action ? <div className="w-full sm:w-auto">{action}</div> : null}
      </div>
    </Card>
  )
}
