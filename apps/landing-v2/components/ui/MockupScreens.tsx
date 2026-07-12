import clsx from 'clsx';
import { inboxRows, aiReply } from '@/data/mock';

const sentimentDot = {
  positive: 'bg-teal',
  negative: 'bg-rose',
  neutral: 'bg-amber',
} as const;

function Stars({ n }: { n: number }) {
  return (
    <span className="font-mono text-[11px] text-amber">
      {'★'.repeat(n)}
      <span className="text-ink/15">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

/** Экран 1: единый инбокс отзывов */
export function InboxScreen({ className }: { className?: string }) {
  return (
    <div className={clsx('flex h-full flex-col gap-2 p-5', className)}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-display text-xs font-semibold text-ink">Инбокс</span>
        <div className="flex gap-1.5">
          {['Все', 'Без ответа', 'Негатив'].map((f, i) => (
            <span
              key={f}
              className={clsx(
                'rounded-full px-2.5 py-1 font-mono text-[10px]',
                i === 0 ? 'bg-electric text-white' : 'bg-ink/5 text-ink/50',
              )}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
      {inboxRows.map((r) => (
        <div key={r.author} className="flex items-start gap-3 rounded-xl bg-ink/[0.04] p-3">
          <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', sentimentDot[r.sentiment])} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-ink/40">{r.source} · {r.author}</span>
              <Stars n={r.rating} />
            </div>
            <p className="truncate text-xs text-ink/70">{r.text}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-electric/10 px-2 py-1 font-mono text-[10px] text-electric">
            Ответить
          </span>
        </div>
      ))}
    </div>
  );
}

/** Экран 2: AI-черновик ответа */
export function AiReplyScreen({ className }: { className?: string }) {
  return (
    <div className={clsx('flex h-full flex-col gap-3 p-5', className)}>
      <div className="rounded-xl bg-ink/[0.04] p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[10px] text-ink/40">
            {aiReply.review.source} · {aiReply.review.author}
          </span>
          <Stars n={aiReply.review.rating} />
        </div>
        <p className="text-xs text-ink/70">{aiReply.review.text}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber/15 px-2.5 py-1 font-mono text-[10px] text-amber">
          ✦ AI-черновик
        </span>
        <span className="font-mono text-[10px] text-ink/30">YandexGPT · дружелюбный тон</span>
      </div>
      <div className="flex-1 rounded-xl border border-electric/20 bg-electric/[0.04] p-3">
        {aiReply.reply.map((line) => (
          <p key={line} data-ai-line className="text-xs leading-relaxed text-ink/80">
            {line}
          </p>
        ))}
      </div>
      <div className="flex gap-2">
        <span className="rounded-lg bg-electric px-3 py-1.5 font-mono text-[10px] text-white">Опубликовать</span>
        <span className="rounded-lg bg-ink/5 px-3 py-1.5 font-mono text-[10px] text-ink/50">Перегенерировать</span>
      </div>
    </div>
  );
}

/** Экран 3: аналитика тональности */
export function AnalyticsScreen({ className }: { className?: string }) {
  return (
    <div className={clsx('flex h-full flex-col gap-3 p-5', className)}>
      <span className="font-display text-xs font-semibold text-ink">Аналитика</span>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['4.6', 'средний рейтинг', 'text-amber'],
          ['+18%', 'позитив за месяц', 'text-teal'],
          ['−31%', 'негатив без ответа', 'text-rose'],
        ].map(([v, l, c]) => (
          <div key={l} className="rounded-xl bg-ink/[0.04] p-3">
            <div className={clsx('font-display text-lg font-bold', c)}>{v}</div>
            <div className="font-mono text-[9px] leading-tight text-ink/40">{l}</div>
          </div>
        ))}
      </div>
      <div className="relative flex-1 rounded-xl bg-ink/[0.04] p-3">
        <svg viewBox="0 0 300 90" fill="none" className="h-full w-full" aria-hidden="true">
          <path
            data-chart-line
            d="M5 75 C 40 72, 70 60, 110 55 S 190 40, 230 25 S 280 12, 295 10"
            stroke="#2DD4BF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            data-chart-line
            d="M5 35 C 45 40, 90 50, 140 60 S 230 74, 295 78"
            stroke="#FF5C7A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
