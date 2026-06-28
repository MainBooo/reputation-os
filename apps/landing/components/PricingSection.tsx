const plans = [
  ['Старт', 'Малый бизнес, 1–2 точки', '990 ₽', ['До 3 компаний', 'Яндекс Карты + 2ГИС', 'Единый Inbox отзывов', '50 AI-ответов в месяц']],
  ['Бизнес', 'Растущий бизнес и сети', '2 990 ₽', ['До 10 компаний', 'Все платформы + Web', 'Безлимит AI-ответов', 'Аналитика и Telegram-алерты']],
  ['Агентство', 'ORM-агентства и франшизы', '6 990 ₽', ['Без ограничений по компаниям', 'Всё из тарифа «Бизнес»', 'White-label брендировка', 'API-доступ']]
]

export default function PricingSection() {
  return (
    <section id="pricing" className="pricing">
      <img className="pricing-cosmonaut" src="/images/backgrounds/fon2.png" alt="" aria-hidden="true" />
      <div className="pricing-head">
        <h2>Простые тарифы. Никаких скрытых платежей.</h2>
      </div>

      <div className="price-grid">
        {plans.map(([name, subtitle, price, features], index) => (
          <article className={`price-card ${index === 1 ? 'popular' : ''}`} key={String(name)}>
            {index === 1 && <b className="badge">Популярный</b>}
            <h3>{name}</h3>
            <p>{subtitle}</p>
            <strong>{price}<small> / мес</small></strong>
            <ul>{(features as string[]).map((f) => <li key={f}>✓ {f}</li>)}</ul>
            <a
              className={index === 1 ? 'btn btn-gradient' : 'btn btn-glass'}
              href="https://reputation.generationweb.ru/register"
            >
              Попробовать 14 дней
            </a>
          </article>
        ))}
      </div>
      <p className="pricing-note">14 дней бесплатно на любом тарифе · Без привязки карты</p>
    </section>
  )
}
