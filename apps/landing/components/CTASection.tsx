export default function CTASection() {
  return (
    <section className="final-cta">
      <span className="logo-slot logo-slot--cta">
        <img
          src="/images/logo/logo.png"
          alt="Reputation OS"
          width={112}
          height={112}
          className="logo-img"
        />
      </span>
      <div>
        <h2>Готовы взять репутацию под контроль?</h2>
        <p>Попробуйте Reputation OS бесплатно 14 дней. Без карты. Без обязательств.</p>
      </div>
      <a className="btn btn-gradient btn-xl" href="https://reputation.generationweb.ru/register">Запустить бесплатно →</a>
    </section>
  )
}
