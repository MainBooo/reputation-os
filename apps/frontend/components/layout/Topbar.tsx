export default function Topbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-5 lg:px-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Workspace</div>
          <div className="text-sm font-medium text-brand">Demo Workspace</div>
        </div>
        <div className="rounded-full border border-line bg-panel2 px-3 py-1.5 text-xs text-muted">
          demo@reputation.local
        </div>
      </div>
    </header>
  )
}
