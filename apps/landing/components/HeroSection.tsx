import HeroOrbitSvg from './HeroOrbitSvg'

const trust = [
  ['14 дней бесплатно', 'Без карты'],
  ['Без обязательств', 'Отмена в 1 клик'],
  ['Безопасность данных', 'Enterprise-уровень'],
  ['Поддержка 24/7', 'Живой эфир']
]

export default function HeroSection() {
  return (
    <section className="hero">
      <HeroOrbitSvg />

      <div className="hero-copy">
<h1>ОПЕРАЦИОННАЯ СИСТЕМА<br />ВАШЕЙ <span>РЕПУТАЦИИ</span></h1>
        <p className="lead">
          Единая система для управления отзывами, рейтингами, упоминаниями и репутационными рисками в одном пространстве в реальном времени.
        </p>

        <div className="hero-actions">
          <a className="btn btn-gradient btn-xl" href="https://reputation.generationweb.ru/login">Войти в систему →</a>
        </div>
      </div>

      <div className="hero-benefits-strip">
        {trust.map(([title, text]) => (
          <div key={title}>
            <i>✦</i>
            <b>{title}</b>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
