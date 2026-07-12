'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { gsap, MM } from '@/lib/gsap';
import { plans, REGISTER_URL } from '@/data/mock';

export default function Pricing() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia(root);

    mm.add([MM.desktop, MM.mobile], () => {
      gsap.from('[data-plan]', {
        opacity: 0,
        y: 70,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.15,
        scrollTrigger: { trigger: root.current, start: 'top 70%', once: true },
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} data-bg="#0B0E1F" className="py-24 text-paper md:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-paper/40">тарифы</span>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">
            Просто и по делу
          </h2>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <article
              key={p.name}
              data-plan
              className={clsx(
                'flex flex-col rounded-3xl border p-8',
                p.highlighted
                  ? 'border-electric bg-electric/[0.08] md:-translate-y-4'
                  : 'border-white/10 bg-white/[0.04]',
              )}
            >
              {p.highlighted && (
                <span className="mb-4 self-start rounded-full bg-electric px-3 py-1 font-mono text-[11px] text-white">
                  популярный
                </span>
              )}
              <h3 className="font-display text-2xl font-bold">{p.name}</h3>
              <p className="mt-1 text-sm text-paper/50">{p.audience}</p>
              <div className="mt-6 font-display text-4xl font-bold">
                {p.price}
                <span className="font-mono text-sm font-normal text-paper/40"> / мес</span>
              </div>
              <ul className="mt-8 flex-1 space-y-3">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-paper/70">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                    {b}
                  </li>
                ))}
              </ul>
              <a
                href={REGISTER_URL}
                className={clsx(
                  'mt-10 rounded-full py-3 text-center font-display text-sm font-semibold transition-colors',
                  p.highlighted
                    ? 'bg-electric text-white hover:bg-electric/90'
                    : 'border border-white/20 text-paper hover:bg-white/10',
                )}
              >
                Начать
              </a>
            </article>
          ))}
        </div>
        <p className="mt-10 text-center font-mono text-xs text-paper/40">
          Регистрация бесплатная — тариф можно выбрать позже
        </p>
      </div>
    </section>
  );
}
