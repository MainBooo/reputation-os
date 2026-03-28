export default function SimpleLineChart({
  points
}: {
  points: { label: string; value: number }[]
}) {
  if (!points.length) {
    return <div className="text-sm text-muted">No data</div>
  }

  const width = 100
  const height = 40
  const max = Math.max(...points.map((p) => p.value), 1)
  const min = Math.min(...points.map((p) => p.value), 0)
  const spread = Math.max(max - min, 1)

  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width
      const y = height - ((point.value - min) / spread) * height
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-white/80" />
      </svg>
      <div className="mt-3 flex justify-between gap-2 text-xs text-muted">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  )
}
