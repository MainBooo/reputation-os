import Image from 'next/image'

const PARTICLES = [
  { s: 2,   x: '56%', y: '6%',  o: 0.32, d: 3.7, dl: 0.3 },
  { s: 1.5, x: '68%', y: '18%', o: 0.50, d: 2.6, dl: 1.8 },
  { s: 2,   x: '78%', y: '35%', o: 0.40, d: 3.9, dl: 0.9 },
  { s: 1.5, x: '82%', y: '58%', o: 0.45, d: 3.2, dl: 2.1 },
  { s: 2,   x: '74%', y: '76%', o: 0.35, d: 4.3, dl: 0.4 },
  { s: 2.5, x: '62%', y: '82%', o: 0.28, d: 3.6, dl: 1.5 },
  { s: 1,   x: '60%', y: '28%', o: 0.62, d: 2.2, dl: 1.6 },
  { s: 1.5, x: '88%', y: '46%', o: 0.25, d: 4.0, dl: 0.6 },
  { s: 2,   x: '92%', y: '28%', o: 0.28, d: 4.2, dl: 2.0 },
  { s: 1,   x: '94%', y: '66%', o: 0.30, d: 3.5, dl: 0.5 },
  { s: 1,   x: '72%', y: '10%', o: 0.45, d: 2.5, dl: 3.0 },
]

/*
  Explicit ellipse (40% × 52% of div) so the gradient reaches transparent
  well before the div edges — eliminates the visible dark-background rectangle.
  Center (65%, 48%) aligns with the sphere's bright core in sphere.PNG.
*/
const SPHERE_MASK =
  'radial-gradient(ellipse 40% 52% at 65% 48%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 34%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0.2) 76%, rgba(0,0,0,0) 90%)'

export default function HeroSection() {
  return (
    <section className="hero-section relative z-10 overflow-hidden">

      {/* Atmospheric glow — lowest layer */}
      <div className="hero-bg-glow pointer-events-none absolute" aria-hidden="true" />

      {/* Concentrated bloom around sphere core — desktop only */}
      <div className="hero-bg-bloom pointer-events-none absolute hidden lg:block" aria-hidden="true" />

      {/* Particle field — desktop only, right half of viewport */}
      <div
        className="pointer-events-none absolute inset-0 overflow-visible hidden lg:block"
        style={{ zIndex: 2 }}
        aria-hidden="true"
      >
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-cyan-300"
            style={{
              width: `${p.s}px`,
              height: `${p.s}px`,
              left: p.x,
              top: p.y,
              opacity: p.o,
              animation: `sphere-particle ${p.d}s ease-in-out ${p.dl}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Single sphere image — ONE element, same on desktop and mobile */}
      <div
        className="hero-sphere pointer-events-none absolute"
        aria-hidden="true"
        style={{
          maskImage: SPHERE_MASK,
          WebkitMaskImage: SPHERE_MASK,
        }}
      >
        <Image
          src="/images/hero/sphere.PNG"
          alt=""
          width={1695}
          height={928}
          priority
          className="h-auto w-full object-contain"
        />
      </div>

      {/* Text content — always above sphere */}
      <div className="relative z-20 mx-auto w-full max-w-7xl px-7 py-10 lg:px-8 lg:py-24">
        <div className="max-w-2xl text-left">
          <h1 className="text-[34px] font-semibold uppercase leading-tight tracking-tight text-white sm:text-5xl md:text-5xl">
            ВСЕ ОТЗЫВЫ КЛИЕНТОВ —<br />
            ПОД КОНТРОЛЕМ <span className="text-cyan-300">ЗА 5 МИНУТ</span>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-7 text-slate-300 lg:mt-6">
            Reputation OS собирает отзывы с Яндекс Карт, 2ГИС и web-источников в единый Inbox — и сразу показывает, где горит и что ответить.
          </p>

          <div className="mt-6 flex lg:mt-8">
            <a
              className="hero-cta-premium"
              href="https://reputation.generationweb.ru/login"
            >
              Войти в систему →
            </a>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-400 lg:mt-5">
            <span>✓ Без установки</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>✓ Яндекс + 2ГИС + Web</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>✓ AI-ответы включены</span>
          </div>
        </div>
      </div>
    </section>
  )
}
