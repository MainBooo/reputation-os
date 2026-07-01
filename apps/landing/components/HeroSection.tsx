import Image from 'next/image'

export default function HeroSection() {
  return (
    <section className="hero-section relative">

      {/* Atmospheric glow — sits behind everything, its center is tied
          to the illustration's position and grows with it per breakpoint. */}
      <div className="hero-glow pointer-events-none absolute" aria-hidden="true" />

      {/* The illustration itself: a single large layer, absolutely
          positioned so it can bleed past the section's right (and on
          mobile, bottom) edge freely — it is not a grid sibling of the
          text, so its scale is never constrained by a column width. */}
      <div className="hero-art pointer-events-none absolute" aria-hidden="true">
        <Image
          src="/images/hero/hero-globe.png"
          alt=""
          width={353}
          height={745}
          priority
          className="hero-art-img"
        />
      </div>

      {/* Scrim: darkens the illustration under/around the text so
          contrast holds wherever the two overlap, without ever moving
          or shrinking the illustration itself. */}
      <div className="hero-scrim pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="hero-content relative">
        <div className="hero-copy">
          <h1 className="hero-heading text-[34px] font-semibold uppercase tracking-tight text-white md:text-5xl">
            ВСЕ ОТЗЫВЫ КЛИЕНТОВ —<br />
            ПОД КОНТРОЛЕМ <span className="text-cyan-300">ЗА 5 МИНУТ</span>
          </h1>

          <p className="hero-lead mt-5 max-w-2xl text-lg text-slate-300">
            Reputation OS собирает отзывы с Яндекс Карт, 2ГИС и web-источников в единый Inbox — и сразу показывает, где горит и что ответить.
          </p>

          <div className="hero-cta-row flex">
            <a
              className="hero-cta-premium"
              href="https://reputation.generationweb.ru/login"
            >
              Войти в систему →
            </a>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>✓ Без установки</span>
            <span><span className="text-slate-500" aria-hidden="true">· </span>✓ Яндекс + 2ГИС + Web</span>
            <span><span className="text-slate-500" aria-hidden="true">· </span>✓ AI-ответы включены</span>
          </div>
        </div>
      </div>
    </section>
  )
}
