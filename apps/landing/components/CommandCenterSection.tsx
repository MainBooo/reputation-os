import Image from 'next/image'

export default function CommandCenterSection() {
  return (
    <section className="command-center">
      <div>
        <p className="kicker">COMMAND CENTER</p>
        <h2>Ваш центр управления репутацией</h2>
        <p>Получайте полную картину в реальном времени и действуйте на опережение.</p>
        <ul>
          <li>Все упоминания и отзывы — в одном месте</li>
          <li>Реакция в один клик</li>
          <li>Аналитика, которая показывает рост</li>
          <li>Данные, которые помогают зарабатывать</li>
        </ul>
        <a className="btn btn-glass" href="https://reputation.generationweb.ru/login">
          Посмотреть демо панели →
        </a>
      </div>

      <div className="command-shot">
        <Image
          src="/images/hero/fon.png"
          alt="Command Center Reputation OS"
          width={980}
          height={620}
        />
      </div>
    </section>
  )
}
