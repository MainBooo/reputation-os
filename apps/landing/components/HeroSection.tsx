import HeroOrbitSvg from './HeroOrbitSvg'

export default function HeroSection() {
  return (
    <section className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-7 py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
      <div className="relative z-20 max-w-2xl text-left">
        <h1 className="text-5xl font-semibold uppercase leading-tight tracking-tight text-white sm:text-5xl md:text-5xl">
          ОПЕРАЦИОННАЯ СИСТЕМА<br />
          ВАШЕЙ <span className="text-cyan-300">РЕПУТАЦИИ</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-7 text-slate-300">
          Единая система для управления отзывами, рейтингами, упоминаниями и репутационными рисками в одном пространстве в реальном времени.
        </p>

        <div className="mt-8 flex">
          <a
            className="hero-cta-premium"
            href="https://reputation.generationweb.ru/login"
          >
            Войти в систему →
          </a>
        </div>
      </div>

      <HeroOrbitSvg />
    </section>
  )
}
