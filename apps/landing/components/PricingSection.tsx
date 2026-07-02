import Image from 'next/image'

const plans = [
  ['Старт', 'Малый бизнес, 1–2 точки', '890 ₽', ['До 3 компаний', 'Яндекс Карты + 2ГИС', 'Единый Inbox отзывов', '50 AI-ответов в месяц']],
  ['Бизнес', 'Растущий бизнес и сети', '1 890 ₽', ['До 10 компаний', 'Все платформы + Web', 'Безлимит AI-ответов', 'Аналитика и Telegram-алерты']],
  ['Агентство', 'ORM-агентства и франшизы', '3 990 ₽', ['До 100 компаний', 'Всё из тарифа «Бизнес»', 'До 20 участников команды', 'До 500 источников']]
]

export default function PricingSection() {
  return (
    <section id="pricing" className="pricing">
      <Image
        className="pricing-cosmonaut"
        src="/images/backgrounds/fon2.png"
        alt=""
        aria-hidden="true"
        width={1536}
        height={1024}
        sizes="1180px"
        loading="lazy"
      />
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
              Попробовать 7 дней
            </a>
          </article>
        ))}
      </div>
      <p className="pricing-note">7 дней бесплатно на тарифе Бизнес · Без привязки карты</p>
    </section>
  )
}
