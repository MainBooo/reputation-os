import Image from 'next/image'

export default function CTASection() {
  return (
    <section className="final-cta">
      <span className="logo-slot logo-slot--cta">
        <Image
          src="/images/logo/logo.png"
          alt="Reputation OS"
          width={76}
          height={76}
          loading="lazy"
          className="logo-img"
        />
      </span>
      <div>
        <h2>Начните мониторинг репутации сегодня</h2>
        <p>14 дней бесплатно. Без карты. Без обязательств. Подключите первую компанию за 5 минут.</p>
      </div>
      <div style={{display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center'}}>
        <a className="btn btn-gradient btn-xl" href="https://reputation.generationweb.ru/register">Попробовать бесплатно →</a>
        <a className="btn btn-glass btn-xl" href="https://t.me/max92pole">Написать в Telegram</a>
      </div>
    </section>
  )
}
