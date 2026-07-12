'use client';

import { useEffect, useRef } from 'react';
import { gsap, MM } from '@/lib/gsap';
import ReviewCard from '@/components/ui/ReviewCard';
import MagneticButton from '@/components/ui/MagneticButton';
import { heroReviews, REGISTER_URL } from '@/data/mock';

/** Позиции разлетевшихся карточек: [left%, top%, rotate°, глубина параллакса] */
const scatter: Array<[string, string, number, number]> = [
  ['4%', '14%', -8, 0.55],
  ['74%', '10%', 6, 0.8],
  ['82%', '52%', -5, 0.45],
  ['8%', '62%', 7, 0.7],
  ['60%', '72%', -10, 0.5],
  ['30%', '6%', 4, 0.65],
];

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia(root);

    mm.add(MM.desktop, () => {
      // Вступление (не привязано к скроллу)
      gsap.from('[data-hero-line]', {
        yPercent: 110,
        duration: 1.1,
        ease: 'power4.out',
        stagger: 0.12,
        delay: 0.15,
      });
      gsap.from('[data-hero-card]', {
        opacity: 0,
        y: 40,
        scale: 0.9,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.07,
        delay: 0.5,
      });
      gsap.from('[data-hero-sub]', { opacity: 0, y: 24, duration: 0.8, delay: 0.9 });

      // Скролл-хореография: pin, строки разъезжаются, карточки стягиваются вниз к центру
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: '+=120%',
          pin: true,
          scrub: 0.8,
        },
      });

      tl.to('[data-hero-line="1"]', { xPercent: -22, ease: 'none' }, 0)
        .to('[data-hero-line="2"]', { xPercent: 22, ease: 'none' }, 0)
        .to('[data-hero-sub]', { opacity: 0, y: -30, ease: 'none' }, 0);

      document.querySelectorAll<HTMLElement>('[data-hero-card]').forEach((card, i) => {
        const depth = scatter[i][3];
        tl.to(
          card,
          {
            left: '50%',
            top: '86%',
            xPercent: -50,
            rotate: 0,
            scale: 0.55,
            opacity: 0.15,
            ease: 'power1.in',
            duration: 0.6 + depth * 0.4,
          },
          0,
        );
      });

      // Фоновые пятна — самый медленный слой
      tl.to('[data-hero-blob="a"]', { yPercent: -18, ease: 'none' }, 0);
      tl.to('[data-hero-blob="b"]', { yPercent: 12, ease: 'none' }, 0);
    });

    mm.add(MM.mobile, () => {
      gsap.from('[data-hero-line]', { yPercent: 110, duration: 1, ease: 'power4.out', stagger: 0.12 });
      gsap.from('[data-hero-sub]', { opacity: 0, y: 20, duration: 0.7, delay: 0.5 });
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="relative flex min-h-screen flex-col justify-center overflow-hidden">
      {/* Слой 1: приглушённые градиентные пятна */}
      <div
        data-hero-blob="a"
        aria-hidden="true"
        className="absolute -left-40 -top-40 h-[42rem] w-[42rem] rounded-full bg-electric/20 blur-[140px]"
      />
      <div
        data-hero-blob="b"
        aria-hidden="true"
        className="absolute -bottom-56 -right-32 h-[36rem] w-[36rem] rounded-full bg-rose/10 blur-[140px]"
      />

      {/* Слой 2: разлетевшиеся карточки отзывов (desktop) */}
      <div aria-hidden="true" className="absolute inset-0 hidden md:block">
        {heroReviews.map((r, i) => (
          <div
            key={i}
            data-hero-card
            className="absolute will-change-transform"
            style={{ left: scatter[i][0], top: scatter[i][1], transform: `rotate(${scatter[i][2]}deg)` }}
          >
            <ReviewCard review={r} />
          </div>
        ))}
      </div>

      {/* Слой 3: заголовок */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
        <h1 className="font-display font-extrabold uppercase leading-[0.95] tracking-tight">
          <span className="block overflow-hidden">
            <span data-hero-line="1" className="block text-[clamp(2.6rem,9vw,8.5rem)] text-paper">
              Репутация
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-hero-line="2" className="block text-[clamp(2.6rem,9vw,8.5rem)] text-electric">
              под контролем
            </span>
          </span>
        </h1>

        <div data-hero-sub className="mt-10 max-w-xl">
          <p className="text-lg leading-relaxed text-paper/70">
            Отзывы с Яндекс.Карт, 2ГИС и веб-источников — в одном инбоксе.
            AI отвечает за секунды, вы управляете репутацией, а не тонете в ней.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <MagneticButton href={REGISTER_URL}>Попробовать бесплатно</MagneticButton>
            <span className="font-mono text-xs text-paper/40">без карты · старт за 5 минут</span>
          </div>
        </div>
      </div>
    </section>
  );
}
