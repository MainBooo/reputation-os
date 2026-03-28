export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-line bg-panel">{children}</div>
}

export function THead({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-12 border-b border-line bg-white/[0.03] px-4 py-3 text-xs uppercase tracking-wide text-muted">{children}</div>
}

export function TRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-12 items-center border-b border-line px-4 py-4 text-sm last:border-b-0">{children}</div>
}
