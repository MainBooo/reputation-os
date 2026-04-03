import Badge from '../ui/Badge'

export default function MentionRow({
  mention
}: {
  mention: any
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={mention.platform}>{mention.platform}</Badge>
            <Badge tone={mention.sentiment}>{mention.sentiment}</Badge>
            <Badge tone={mention.status}>{mention.status}</Badge>
            {mention.type ? <Badge>{mention.type}</Badge> : null}
          </div>

          <div className="mt-3 break-words text-sm leading-6 text-brand [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:5] overflow-hidden">
            {mention.content}
          </div>

          <div className="mt-3 text-xs text-muted">
            {mention.author || 'Unknown'} · {new Date(mention.publishedAt).toLocaleString()}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 sm:block sm:text-right">
          {mention.ratingValue ? <div className="text-lg font-semibold text-brand">{mention.ratingValue}</div> : <div />}
          {mention.url ? (
            <a
              href={mention.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-muted transition hover:text-brand"
            >
              Original source
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
