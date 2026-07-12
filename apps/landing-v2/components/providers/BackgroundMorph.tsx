'use client';

import { useEffect } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap';

/**
 * Перетекание фона между секциями: каждая секция с data-bg="#hex"
 * плавно перекрашивает body при подходе к ней. Секции при этом прозрачные.
 * Исключение — ProductScene: там морф ink→paper зашит в её собственный
 * pin-таймлайн, поэтому она помечается data-bg-self и здесь пропускается.
 */
export default function BackgroundMorph() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      document.querySelectorAll<HTMLElement>('[data-bg]').forEach((sec) => {
        gsap.to('body', {
          backgroundColor: sec.dataset.bg,
          ease: 'none',
          scrollTrigger: {
            trigger: sec,
            start: 'top 75%',
            end: 'top 25%',
            scrub: true,
          },
        });
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
