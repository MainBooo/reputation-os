'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { gsap, MM } from '@/lib/gsap';

/** Бейджи источников на трёх глубинах параллакса */
const badges: Array<{ label: string; depth: 1 | 2 | 3; className: string }> = [
  { label: 'Яндекс.Карты', depth: 1, className: 'bg-amber/15 text-amber border-amber/30' },
  { label: '2ГИС', depth: 2, className: 'bg-teal/10 text-teal border-teal/30' },
  { label: 'Отзовики', depth: 3, className: 'bg-electric/10 text-electric border-electric/30' },
  { label: 'Форумы', depth: 2, className: 'bg-rose/10 text-rose border-rose/30' },
  { label: 'СМИ и блоги', depth: 1, className: 'bg-electric/10 text-electric border-electric/30' },
  { label: 'Маркетплейсы отзывов', depth: 3, className: 'bg-amber/15 text-amber border-amber/30' },
];

export default function Sources() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia(root);

    mm.add([MM.desktop, MM.mobile], () => {
      root.current?.querySelectorAll<HTMLElement>('[data-depth]').forEach((el) => {
        const depth = Number(el.dataset.depth);
        gsap.fromTo(
          el,
          { y: 30 * depth },
          {
            y: -30 * depth,
            ease: 'none',
            scrollTrigger: {
              trigger: root.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="overflow-hidden py-24 text-ink motion-reduce:bg-paper md:py-36">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-ink/40">источники</span>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">
          Гарантированные источники —{' '}
          <span className="text-electric">и весь Рунет сверху</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink/60">
          Именованные источники мониторятся гарантированно. А упоминания бренда система
          находит где угодно в Рунете, индексируемом Яндексом, — на форумах, в блогах и СМИ.
        </p>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {badges.map((b) => (
            <span
              key={b.label}
              data-depth={b.depth}
              className={clsx(
                'rounded-full border px-6 py-3 font-mono text-sm will-change-transform',
                b.className,
                b.depth === 1 && 'text-base md:px-8 md:py-4',
                b.depth === 3 && 'text-xs opacity-80',
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
        <p className="mt-12 font-mono text-xs text-ink/40">
          + всё, что индексирует Яндекс, — автоматически
        </p>
      </div>
    </section>
  );
}
