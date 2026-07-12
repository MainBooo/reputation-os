'use client';

import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsap';

/**
 * Линии тональности: teal (позитив) растёт, rose (негатив) снижается.
 * Рисуются через stroke-dashoffset при входе во вьюпорт.
 */
export default function SentimentChart({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;

    const paths = svg.querySelectorAll<SVGPathElement>('path[data-draw]');
    paths.forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = prefersReducedMotion() ? '0' : `${len}`;
    });

    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.to(paths, {
        strokeDashoffset: 0,
        duration: 1.8,
        ease: 'power2.inOut',
        stagger: 0.3,
        scrollTrigger: { trigger: svg, start: 'top 80%', once: true },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="0 0 600 220"
      fill="none"
      className={className}
      role="img"
      aria-label="График: доля позитивных отзывов растёт, негативных — снижается"
    >
      <g stroke="currentColor" strokeOpacity="0.08">
        {[40, 90, 140, 190].map((y) => (
          <line key={y} x1="0" y1={y} x2="600" y2={y} />
        ))}
      </g>
      <path
        data-draw
        d="M10 170 C 90 168, 130 150, 200 140 S 340 118, 420 80 S 540 40, 590 30"
        stroke="#2DD4BF"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        data-draw
        d="M10 90 C 80 95, 150 110, 230 130 S 380 165, 460 175 S 560 185, 590 188"
        stroke="#FF5C7A"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
