import clsx from 'clsx'

const colorMap: Record<string, string> = {
  POSITIVE: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200',
  NEGATIVE: 'border-rose-300/25 bg-rose-500/10 text-rose-200',
  NEUTRAL: 'border-blue-300/25 bg-blue-500/10 text-blue-200',
  UNKNOWN: 'border-white/10 bg-white/7 text-slate-300',
  NEW: 'border-cyan-300/25 bg-cyan-400/10 text-blue-100',
  REVIEWED: 'border-violet-300/25 bg-violet-500/10 text-violet-200',
  HIDDEN: 'border-white/10 bg-white/7 text-slate-300',
  ARCHIVED: 'border-white/10 bg-white/7 text-slate-400',
  YANDEX: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  TWOGIS: 'border-sky-300/25 bg-sky-400/10 text-sky-200',
  WEB: 'border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-200',
  TELEGRAM: 'border-sky-300/25 bg-sky-400/10 text-sky-200',
  CUSTOM: 'border-violet-300/25 bg-violet-500/10 text-violet-200',
  OWNER: 'border-cyan-300/25 bg-cyan-400/10 text-blue-100',
  OWNED_PROMO: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  CUSTOMER_REVIEW: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200',
  CUSTOMER_COMPLAINT: 'border-rose-300/25 bg-rose-500/10 text-rose-200',
  CUSTOMER_QUESTION: 'border-blue-300/25 bg-blue-500/10 text-blue-200',
  CHAT_DISCUSSION: 'border-white/10 bg-white/7 text-slate-300',
  NEWS_MENTION: 'border-violet-300/25 bg-violet-500/10 text-violet-200',
  IRRELEVANT: 'border-white/10 bg-white/7 text-slate-400',
  SPAM: 'border-red-400/25 bg-red-500/15 text-red-300',
  LOW: 'border-white/10 bg-white/7 text-slate-300',
  MEDIUM: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  HIGH: 'border-red-400/25 bg-red-500/15 text-red-300'
}

export default function Badge({
  children,
  tone
}: {
  children: React.ReactNode
  tone?: string
}) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur',
      tone ? colorMap[tone] || 'border-white/10 bg-white/10 text-brand' : 'border-white/10 bg-white/10 text-brand'
    )}>
      {children}
    </span>
  )
}
