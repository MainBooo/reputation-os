import Card from './Card'

export default function StatCard({
  label,
  value,
  hint
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <Card className="p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-brand">{value}</div>
      {hint ? <div className="mt-2 text-xs text-muted">{hint}</div> : null}
    </Card>
  )
}
