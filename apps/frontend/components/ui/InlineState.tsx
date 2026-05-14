import { AlertTriangle, Loader2, SearchX, ShieldCheck } from 'lucide-react'

type InlineStateTone = 'empty' | 'error' | 'loading' | 'success'

type InlineStateProps = {
  title: string
  description?: string
  tone?: InlineStateTone
}

export default function InlineState({
  title,
  description,
  tone = 'empty'
}: InlineStateProps) {
  const Icon =
    tone === 'error'
      ? AlertTriangle
      : tone === 'loading'
        ? Loader2
        : tone === 'success'
          ? ShieldCheck
          : SearchX

  const toneClass = {
    empty: 'border-cyan-400/15 bg-cyan-500/[0.06] text-cyan-200',
    error: 'border-red-400/20 bg-red-500/[0.08] text-red-200',
    loading: 'border-violet-400/20 bg-violet-500/[0.08] text-violet-200',
    success: 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200'
  }[tone]

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${toneClass}`}>
          <Icon className={`h-5 w-5 ${tone === 'loading' ? 'animate-spin' : ''}`} />
        </span>
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          {description ? (
            <div className="mt-1 text-sm leading-5 text-slate-400">{description}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
