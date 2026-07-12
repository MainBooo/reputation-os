'use client';

import { useEffect, useRef } from 'react';
import { gsap, MM } from '@/lib/gsap';
import MagneticButton from '@/components/ui/MagneticButton';
import { REGISTER_URL } from '@/data/mock';

export default function FinalCta() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia(root);

    mm.add([MM.desktop, MM.mobile], () => {
      gsap.from('[data-cta-word]', {
        yPercent: 110,
        duration: 0.9,
        ease: 'power4.out',
        stagger: 0.1,
        scrollTrigger: { trigger: root.current, start: 'top 70%', once: true },
      });
      gsap.fromTo(
        root.current,
        { scale: 0.96 },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top bottom',
            end: 'center center',
            scrub: true,
          },
        },
      );
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="py-28 text-center text-paper md:py-44">
      <h2 className="mx-auto max-w-5xl px-6 font-display font-extrabold uppercase leading-[0.95] tracking-tight">
        {['Начните', 'сегодня'].map((w, i) => (
          <span key={w} className="block overflow-hidden">
            <span
              data-cta-word
              className={`block text-[clamp(2.6rem,10vw,8rem)] ${i === 1 ? 'text-electric' : ''}`}
            >
              {w}
            </span>
          </span>
        ))}
      </h2>
      <p className="mx-auto mt-8 max-w-md px-6 text-lg text-paper/60">
        Первый отзыв появится в инбоксе через несколько минут после регистрации.
      </p>
      <div className="mt-10">
        <MagneticButton href={REGISTER_URL} className="px-12 py-5 text-base">
          Попробовать бесплатно
        </MagneticButton>
      </div>
    </section>
  );
}
