import AnimatedCounter from '@/components/ui/AnimatedCounter';
import SentimentChart from '@/components/ui/SentimentChart';
import { metrics } from '@/data/mock';

export default function Metrics() {
  return (
    <section className="py-24 text-ink motion-reduce:bg-paper md:py-36">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:grid-cols-2">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-ink/40">результат</span>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">
            Негатив перестаёт копиться
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink/60">
            Когда каждый отзыв виден и на каждый есть ответ — тональность меняется:
            позитив растёт, необработанный негатив уходит в ноль.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6">
            {metrics.map((m) => (
              <div key={m.label}>
                <dt className="sr-only">{m.label}</dt>
                <dd className="font-display text-3xl font-bold text-amber md:text-4xl">
                  <AnimatedCounter value={m.value} suffix={m.suffix} />
                </dd>
                <dd className="mt-2 font-mono text-[11px] leading-tight text-ink/50">{m.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="text-ink">
          <SentimentChart className="w-full" />
          <div className="mt-4 flex gap-6 font-mono text-xs text-ink/50">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-teal" /> позитивные отзывы
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-rose" /> негатив без ответа
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
