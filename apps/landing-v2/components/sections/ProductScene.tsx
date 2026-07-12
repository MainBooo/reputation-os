'use client';

import { useEffect, useRef } from 'react';
import { gsap, MM } from '@/lib/gsap';
import { InboxScreen, AiReplyScreen, AnalyticsScreen } from '@/components/ui/MockupScreens';

const captions = [
  {
    n: '01',
    title: 'Все отзывы — в одном инбоксе',
    text: 'Яндекс.Карты, 2ГИС и веб-источники стекаются в единую ленту: статусы, фильтры, тональность.',
  },
  {
    n: '02',
    title: 'AI пишет ответ за секунды',
    text: 'YandexGPT или OpenAI готовит черновик в тоне вашего бренда — остаётся нажать «Опубликовать».',
  },
  {
    n: '03',
    title: 'Аналитика показывает динамику',
    text: 'Рейтинг, тональность и скорость реакции — по каждой точке и каждому источнику.',
  },
];

function Mockup({ screen }: { screen: 1 | 2 | 3 }) {
  const Screen = [InboxScreen, AiReplyScreen, AnalyticsScreen][screen - 1];
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl shadow-ink/20">
      <div className="flex items-center gap-1.5 border-b border-ink/5 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-rose/60" />
        <span className="h-2 w-2 rounded-full bg-amber/60" />
        <span className="h-2 w-2 rounded-full bg-teal/60" />
      </div>
      <div className="h-[22rem]">
        <Screen />
      </div>
    </div>
  );
}

export default function ProductScene() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia(root);

    mm.add(MM.desktop, () => {
      const scene = root.current?.querySelector('[data-scene]');
      if (!scene) return;
      const q = gsap.utils.selector(scene as HTMLElement);

      const chartLines = Array.from(
        (scene as HTMLElement).querySelectorAll<SVGPathElement>('[data-chart-line]'),
      );
      chartLines.forEach((p) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
      });

      gsap.set(q('[data-screen="2"], [data-screen="3"]'), { autoAlpha: 0, y: 60 });
      gsap.set(q('[data-caption="2"], [data-caption="3"]'), { autoAlpha: 0, y: 28 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scene,
          start: 'top top',
          end: '+=250%',
          pin: true,
          scrub: 0.8,
        },
      });

      tl.fromTo(
        q('[data-mockup]'),
        { rotationX: 7, rotationY: -6, scale: 0.94 },
        { rotationX: 0, rotationY: 0, scale: 1, duration: 0.6, ease: 'none' },
        0,
      )
        // экран 1 → 2
        .to(q('[data-screen="1"]'), { autoAlpha: 0, y: -60, duration: 0.5 }, 0.9)
        .to(q('[data-caption="1"]'), { autoAlpha: 0, y: -28, duration: 0.4 }, '<')
        .to(q('[data-screen="2"]'), { autoAlpha: 1, y: 0, duration: 0.5 }, '<0.15')
        .to(q('[data-caption="2"]'), { autoAlpha: 1, y: 0, duration: 0.4 }, '<')
        .from(q('[data-ai-line]'), { opacity: 0, y: 14, stagger: 0.12, duration: 0.35 }, '<0.25')
        // морф фона ink → paper внутри пина + цвет подписей
        .to('body', { backgroundColor: '#F2F4FB', duration: 0.9, ease: 'none' }, 1.5)
        .to(q('[data-captions]'), { color: '#0B0E1F', duration: 0.9, ease: 'none' }, '<')
        // экран 2 → 3
        .to(q('[data-screen="2"]'), { autoAlpha: 0, y: -60, duration: 0.5 }, 2.5)
        .to(q('[data-caption="2"]'), { autoAlpha: 0, y: -28, duration: 0.4 }, '<')
        .to(q('[data-screen="3"]'), { autoAlpha: 1, y: 0, duration: 0.5 }, '<0.15')
        .to(q('[data-caption="3"]'), { autoAlpha: 1, y: 0, duration: 0.4 }, '<')
        .to(chartLines, { strokeDashoffset: 0, duration: 0.7, stagger: 0.15 }, '<0.2')
        .to({}, { duration: 0.4 }); // пауза-хвост, чтобы финальный кадр «подышал»
    });

    mm.add(MM.mobile, () => {
      // на мобильном пина нет — фон переезжает простым скрабом по секции
      gsap.to('body', {
        backgroundColor: '#F2F4FB',
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top 90%',
          end: 'top 40%',
          scrub: true,
        },
      });
      gsap.utils.toArray<HTMLElement>('[data-stack-item]').forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 40,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="relative">
      {/* Desktop: закреплённая сцена, скролл листает экраны продукта */}
      <div data-scene className="hidden h-screen items-center overflow-hidden md:motion-safe:flex">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 items-center gap-16 px-6">
          <div data-captions className="relative text-paper" style={{ color: '#F2F4FB' }}>
            {captions.map((c, i) => (
              <div
                key={c.n}
                data-caption={i + 1}
                className={i === 0 ? 'relative' : 'absolute inset-0'}
              >
                <div className="font-mono text-sm text-electric">{c.n}</div>
                <h2 className="mt-3 font-display text-4xl font-bold leading-tight">{c.title}</h2>
                <p className="mt-5 max-w-md text-lg leading-relaxed opacity-70">{c.text}</p>
              </div>
            ))}
          </div>
          <div style={{ perspective: '1200px' }}>
            <div data-mockup className="relative will-change-transform">
              <div data-screen="1" className="relative">
                <Mockup screen={1} />
              </div>
              <div data-screen="2" className="absolute inset-0">
                <Mockup screen={2} />
              </div>
              <div data-screen="3" className="absolute inset-0">
                <Mockup screen={3} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile и prefers-reduced-motion: вертикальный стек */}
      <div className="space-y-16 px-6 py-20 md:motion-safe:hidden motion-reduce:bg-paper">
        {captions.map((c, i) => (
          <div key={c.n} data-stack-item className="mx-auto max-w-md">
            <div className="font-mono text-sm text-electric">{c.n}</div>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-ink">
              {c.title}
            </h2>
            <p className="mb-6 mt-3 text-base leading-relaxed text-ink/70">{c.text}</p>
            <Mockup screen={(i + 1) as 1 | 2 | 3} />
          </div>
        ))}
      </div>
    </section>
  );
}
