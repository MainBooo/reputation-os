import clsx from 'clsx'

const colorMap: Record<string, string> = {
  POSITIVE: 'bg-emerald-500/15 text-emerald-300',
  NEGATIVE: 'bg-red-500/15 text-red-300',
  NEUTRAL: 'bg-zinc-500/15 text-zinc-300',
  UNKNOWN: 'bg-zinc-500/15 text-zinc-300',
  NEW: 'bg-blue-500/15 text-blue-300',
  REVIEWED: 'bg-violet-500/15 text-violet-300',
  HIDDEN: 'bg-zinc-500/15 text-zinc-300',
  ARCHIVED: 'bg-zinc-500/15 text-zinc-400',
  VK: 'bg-sky-500/15 text-sky-300',
  YANDEX: 'bg-yellow-500/15 text-yellow-300',
  GOOGLE: 'bg-emerald-500/15 text-emerald-300',
  TWOGIS: 'bg-lime-500/15 text-lime-300',
  WEB: 'bg-fuchsia-500/15 text-fuchsia-300',
  CUSTOM: 'bg-orange-500/15 text-orange-300',
  BRAND_SEARCH: 'bg-sky-500/15 text-sky-300',
  PRIORITY_COMMUNITIES: 'bg-violet-500/15 text-violet-300',
  OWNED_COMMUNITY: 'bg-emerald-500/15 text-emerald-300',
  PRIORITY_COMMUNITY: 'bg-violet-500/15 text-violet-300',
  OWNER: 'bg-emerald-500/15 text-emerald-300'
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
      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
      tone ? colorMap[tone] || 'bg-white/10 text-brand' : 'bg-white/10 text-brand'
    )}>
      {children}
    </span>
  )
}
