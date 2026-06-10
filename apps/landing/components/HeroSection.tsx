import HeroOrbitSvg from './HeroOrbitSvg'

export default function HeroSection() {
  return (
    <section className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-7 py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
      <div className="hero-mobile-copy relative z-20 max-w-2xl text-left">
        <h1 className="text-[34px] font-semibold uppercase leading-tight tracking-tight text-white sm:text-5xl md:text-5xl">
          ВСЕ ОТЗЫВЫ КЛИЕНТОВ —<br />
          ПОД КОНТРОЛЕМ <span className="text-cyan-300">ЗА 5 МИНУТ</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-7 text-slate-300">
          Reputation OS собирает отзывы с Яндекс Карт, 2ГИС и web-источников в единый Inbox — и сразу показывает, где горит и что ответить.
        </p>

        <div className="mt-8 flex">
          <a
            className="hero-cta-premium"
            href="https://reputation.generationweb.ru/login"
          >
            Войти в систему →
          </a>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-400">
          <span>✓ Без установки</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>✓ Яндекс + 2ГИС + Web</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>✓ AI-ответы включены</span>
        </div>
      </div>

      <HeroOrbitSvg />
    </section>
  )
}
