import clsx from 'clsx';
import type { MockReview } from '@/data/mock';

const sentimentDot = {
  positive: 'bg-teal',
  negative: 'bg-rose',
  neutral: 'bg-amber',
} as const;

const sourceBadge = {
  'Яндекс.Карты': 'bg-amber/15 text-amber',
  '2ГИС': 'bg-teal/15 text-teal',
  Web: 'bg-electric/15 text-electric',
} as const;

export default function ReviewCard({
  review,
  className,
}: {
  review: MockReview;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'w-64 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={clsx(
            'rounded-full px-2.5 py-0.5 font-mono text-[11px]',
            sourceBadge[review.source],
          )}
        >
          {review.source}
        </span>
        <span className="font-mono text-xs text-amber" aria-label={`Оценка ${review.rating} из 5`}>
          {'★'.repeat(review.rating)}
          <span className="text-white/20">{'★'.repeat(5 - review.rating)}</span>
        </span>
      </div>
      <p className="text-sm leading-snug text-paper/80">{review.text}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className={clsx('h-1.5 w-1.5 rounded-full', sentimentDot[review.sentiment])} />
        <span className="font-mono text-[11px] text-paper/50">{review.author}</span>
      </div>
    </div>
  );
}
