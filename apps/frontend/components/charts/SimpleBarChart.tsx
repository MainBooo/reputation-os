export function SimpleBarChart({
  items
}: {
  items: Array<{ label: string; value: number }>
}) {
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-200">{item.label}</span>
            <span className="text-muted">{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-white/5">
            <div className="h-2 rounded-full bg-white" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
