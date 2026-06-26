const plans = [
  ['Старт', 'Малый бизнес, 1–2 точки', '990 ₽', ['До 2 компаний', 'Яндекс Карты + 2ГИС', 'Единый Inbox отзывов', '5 AI-ответов в месяц']],
  ['Про', 'Растущий бизнес и сети', '1 990 ₽', ['До 10 компаний', 'Все платформы + Web', 'Безлимит AI-ответов', 'Аналитика и Telegram-алерты']],
  ['Агентство', 'ORM-агентства и франшизы', '3 990 ₽', ['Без ограничений по компаниям', 'Всё из тарифа «Про»', 'White-label брендировка', 'API-доступ']]
]

export default function PricingSection() {
  return (
    <section id="pricing" className="pricing">
      <img className="pricing-cosmonaut" src="/images/backgrounds/fon2.png" alt="" aria-hidden="true" />
      <div className="pricing-head">
        <h2>Простые тарифы. Никаких скрытых платежей.</h2>
        <div><span>Месячно</span><span>Годовой −20%</span></div>
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
              href={index === 2 ? 'https://t.me/max92pole' : 'https://reputation.generationweb.ru/register'}
            >
              {index === 2 ? 'Обсудить условия' : 'Попробовать 14 дней'}
            </a>
          </article>
        ))}
      </div>
      <p className="pricing-note">14 дней бесплатно на любом тарифе · Без привязки карты</p>
    </section>
  )
}
