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

        {/* FIX: mobile-safe block */}
        <div className="mt-2 flex flex-col items-start gap-2 sm:mt-0 sm:items-end sm:text-right">
          {mention.ratingValue ? (
            <div className="text-lg font-semibold text-brand">{mention.ratingValue}</div>
          ) : null}

          {mention.url ? (
            <a
              href={mention.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted transition hover:text-brand break-all"
            >
              <a
              href={mention.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-400/20 hover:text-white transition-all"
            >
              Открыть источник →
            </a>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
