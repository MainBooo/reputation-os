export default function EmptyState({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel p-8 text-center">
      <div className="text-base font-semibold text-brand">{title}</div>
      <div className="mt-2 text-sm text-muted">{description}</div>
    </div>
  )
}
