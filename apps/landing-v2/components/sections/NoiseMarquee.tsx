'use client';

import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap';
import { marqueeNegative, marqueePositive } from '@/data/mock';

function Row({
  items,
  tone,
  dir,
}: {
  items: string[];
  tone: 'rose' | 'teal';
  dir: 1 | -1;
}) {
  const doubled = [...items, ...items];
  return (
    <div className="flex overflow-hidden whitespace-nowrap" data-marquee-dir={dir}>
      <div data-marquee-track className="flex shrink-0 items-center">
        {doubled.map((t, i) => (
          <span
            key={i}
            className={`px-6 font-mono text-sm md:text-base ${
              tone === 'rose' ? 'text-rose/70' : 'text-teal/70'
            }`}
          >
            {t}
            <span className="pl-6 text-paper/20">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function NoiseMarquee() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const tweens: gsap.core.Tween[] = [];

      root.current?.querySelectorAll<HTMLElement>('[data-marquee-dir]').forEach((row) => {
        const dir = Number(row.dataset.marqueeDir) as 1 | -1;
        const track = row.querySelector('[data-marquee-track]');
        if (!track) return;
        tweens.push(
          gsap.fromTo(
            track,
            { xPercent: dir === 1 ? 0 : -50 },
            { xPercent: dir === 1 ? -50 : 0, ease: 'none', duration: 40, repeat: -1 },
          ),
        );
      });

      // Скорость бегущих строк реагирует на velocity скролла
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 800, 4);
          tweens.forEach((t) => gsap.to(t, { timeScale: boost, duration: 0.4, overwrite: true }));
        },
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative py-20 md:py-28" aria-hidden="true">
      <div className="mb-6 px-6 text-center font-mono text-xs uppercase tracking-[0.3em] text-paper/30">
        каждый день о вас пишут — где-то там
      </div>
      <div className="space-y-4 -rotate-1">
        <Row items={marqueeNegative} tone="rose" dir={1} />
        <Row items={marqueePositive} tone="teal" dir={-1} />
      </div>
    </section>
  );
}
