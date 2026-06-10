const plans = [
  ['Старт', 'Малый бизнес, 1–2 точки', '3 990 ₽', ['До 2 компаний', 'Яндекс + 2ГИС + Web', 'Единый Inbox отзывов', 'AI-ответы на отзывы']],
  ['Бизнес', 'Агентства и растущий бизнес', '7 990 ₽', ['До 10 компаний', 'Всё из тарифа «Старт»', 'Расширенная аналитика и отчёты', 'Алерты и риск-сигналы']],
  ['Сеть', 'Сети, франшизы, ORM-агентства', '14 990 ₽', ['Без ограничений по компаниям', 'Всё из тарифа «Бизнес»', 'White-label брендировка', 'API-доступ']]
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
              {index === 2 ? 'Обсудить условия' : 'Начать бесплатно'}
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
