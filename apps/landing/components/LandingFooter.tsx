const cols = [
  ['Продукт', 'Возможности', 'Тарифы', 'Интеграции', 'Roadmap'],
  ['Компания', 'О нас', 'Блог', 'Карьера', 'Контакты'],
  ['Поддержка', 'FAQ', 'Документация', 'Связаться с нами', 'Статус системы'],
  ['Мы в соцсетях', 'Telegram', 'VK', 'YouTube', 'Instagram']
]

export default function LandingFooter() {
  return (
    <footer className="footer">
      <div>
        <a href="/" className="brand" aria-label="Reputation OS">
          <span className="logo-slot logo-slot--footer">
            <img
              src="/images/logo/logo.png"
              alt="Reputation OS"
              width={142}
              height={26}
              className="logo-img"
            />
          </span>
        </a>
        <p>Операционная система для управления репутацией вашего бизнеса.</p>
        <small>© 2024 Reputation OS. All rights reserved.</small>
      </div>

      {cols.map(([title, ...links]) => (
        <div key={title}>
          <h4>{title}</h4>
          {links.map((link) => <a href="#" key={link}>{link}</a>)}
        </div>
      ))}
    </footer>
  )
}
