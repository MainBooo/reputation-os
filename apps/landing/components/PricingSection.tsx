const plans = [
  ['Старт', 'Для малого бизнеса и старта', '3 990 ₽', ['Мониторинг отзывов и упоминаний', 'Ответы в единой ленте', 'До 2 компаний', 'Базовая аналитика']],
  ['Бизнес', 'Для растущих компаний', '7 990 ₽', ['Всё из тарифа «Старт»', 'Расширенная аналитика', 'ИИ-оповещения и риски', 'До 10 компаний']],
  ['Сеть', 'Для сетей и агентств', '14 990 ₽', ['Всё из тарифа «Бизнес»', 'Пользователи и роли', 'White-label решения', 'Подключение по API']]
]

export default function PricingSection() {
  return (
    <section id="pricing" className="pricing">
      <img className="pricing-cosmonaut" src="/images/backgrounds/fon2.png" alt="" aria-hidden="true" />
<div className="pricing-head">
        <h2>Простые тарифы — максимальный результат</h2>
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
            <a className={index === 1 ? 'btn btn-gradient' : 'btn btn-glass'} href="https://reputation.generationweb.ru/register">Начать бесплатно</a>
          </article>
        ))}
      </div>
    </section>
  )
}
