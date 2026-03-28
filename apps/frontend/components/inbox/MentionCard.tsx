import Link from 'next/link'
import clsx from 'clsx'
import {
  mentionSentimentClass,
  mentionSentimentLabel,
  mentionStatusClass,
  mentionStatusLabel,
  mentionTypeLabel
} from '@/lib/ui/mentions'
import { updateMentionStatus } from '@/lib/api/mentions'
import { useRouter } from 'next/navigation'

type MentionCardProps = {
  mention: any
}

export default function MentionCard({ mention }: MentionCardProps) {
  const router = useRouter()

  async function handleStatus(status: 'REVIEWED' | 'ARCHIVED') {
    try {
      await updateMentionStatus(mention.id, status)
      router.refresh()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_24px_rgba(34,211,238,0.06)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className={clsx('rounded-full border px-2.5 py-1 text-xs', mentionStatusClass(mention.status))}>
              {mentionStatusLabel(mention.status)}
            </span>
            <span className={clsx('rounded-full border px-2.5 py-1 text-xs', mentionSentimentClass(mention.sentiment))}>
              {mentionSentimentLabel(mention.sentiment)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-200">
              {mentionTypeLabel(mention.type)}
            </span>
            {mention.platform ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">
                {mention.platform}
              </span>
            ) : null}
          </div>

          <div className="text-sm text-slate-300">
            {mention.authorName || 'Автор не указан'}
          </div>

          <div className="text-base leading-7 text-white">
            {mention.title || mention.text || 'Нет текста'}
          </div>

          {mention.createdAt ? (
            <div className="text-xs text-slate-400">
              {new Date(mention.createdAt).toLocaleString('ru-RU')}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {mention.url ? (
            <Link
              href={mention.url}
              target="_blank"
              className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 transition hover:bg-cyan-400/15"
            >
              Открыть источник
            </Link>
          ) : null}
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
          >
            В работу
          </button>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
          >
            В архив
          </button>
        </div>
      </div>
    </div>
  )
}
