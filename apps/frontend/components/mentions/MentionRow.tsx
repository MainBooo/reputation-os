import Badge from '../ui/Badge'

export default function MentionRow({
  mention
}: {
  mention: any
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={mention.platform}>{mention.platform}</Badge>
            <Badge tone={mention.sentiment}>{mention.sentiment}</Badge>
            <Badge tone={mention.status}>{mention.status}</Badge>
            {mention.type ? <Badge>{mention.type}</Badge> : null}
          </div>
          <div className="mt-3 text-sm leading-6 text-brand">{mention.content}</div>
          <div className="mt-3 text-xs text-muted">
            {mention.author || 'Unknown'} · {new Date(mention.publishedAt).toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          {mention.ratingValue ? <div className="text-lg font-semibold text-brand">{mention.ratingValue}</div> : null}
          {mention.url ? (
            <a href={mention.url} target="_blank" className="mt-2 inline-block text-xs text-muted hover:text-brand">
              Original source
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
