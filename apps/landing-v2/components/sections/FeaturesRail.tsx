'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Inbox, Sparkles, BarChart3, Send, Users, ShieldCheck } from 'lucide-react';
import { gsap, MM } from '@/lib/gsap';
import { features, type Feature } from '@/data/mock';

const icons = {
  inbox: Inbox,
  sparkles: Sparkles,
  chart: BarChart3,
  send: Send,
  users: Users,
  shield: ShieldCheck,
} as const;

const accentClasses = {
  electric: 'bg-electric/10 text-electric',
  amber: 'bg-amber/15 text-amber',
  teal: 'bg-teal/10 text-teal',
  rose: 'bg-rose/10 text-rose',
} as const;

function Card({ f, i }: { f: Feature; i: number }) {
  const Icon = icons[f.icon];
  return (
    <article
      className={clsx(
        'flex shrink-0 snap-start flex-col justify-between rounded-3xl border border-ink/5 bg-white p-8 shadow-sm',
        f.size === 'lg' ? 'w-[85vw] md:w-[26rem]' : 'w-[75vw] md:w-[19rem]',
        // разноуровневая посадка карточек, чтобы лента не была монотонной
        i % 3 === 1 ? 'md:translate-y-10' : i % 3 === 2 ? 'md:-translate-y-6' : '',
      )}
    >
      <div>
        <span className={clsx('inline-flex rounded-2xl p-3', accentClasses[f.accent])}>
          <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h3 className="mt-6 font-display text-xl font-bold text-ink md:text-2xl">{f.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-ink/60">{f.desc}</p>
      </div>
      <span className="mt-8 font-mono text-xs text-ink/25">0{i + 1}</span>
    </article>
  );
}

export default function FeaturesRail() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia(root);

    mm.add(MM.desktop, () => {
      const t = track.current;
      if (!t) return;
      const dist = () => t.scrollWidth - window.innerWidth + 96;
      gsap.to(t, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: () => `+=${dist()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="overflow-hidden py-20 text-ink motion-reduce:bg-paper md:motion-safe:flex md:motion-safe:h-screen md:motion-safe:flex-col md:motion-safe:justify-center md:motion-safe:py-0">
      <div className="mx-auto w-full max-w-7xl px-6">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-ink/40">возможности</span>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight md:text-5xl">
          Всё, что нужно для работы с репутацией
        </h2>
      </div>
      <div className="mt-12 md:motion-safe:mt-16">
        <div
          ref={track}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-6 will-change-transform md:gap-8 md:px-24 md:motion-safe:snap-none md:motion-safe:overflow-visible md:motion-safe:pb-0"
        >
          {features.map((f, i) => (
            <Card key={f.title} f={f} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
