export default function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-line bg-[#050816] px-5 py-4 shadow-panel backdrop-blur-xl md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand drop-shadow-[0_0_22px_rgba(168,85,247,0.22)]">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-zinc-300">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  )
}
