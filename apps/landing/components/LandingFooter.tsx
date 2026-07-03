const LEGAL_BASE = 'https://reputation.generationweb.ru'

const cols: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Продукт',
    links: [
      { label: 'Возможности', href: '#' },
      { label: 'Тарифы', href: '#' },
      { label: 'Интеграции', href: '#' },
      { label: 'Roadmap', href: '#' },
    ],
  },
  {
    title: 'Компания',
    links: [
      { label: 'О нас', href: '#' },
      { label: 'Блог', href: '#' },
      { label: 'Карьера', href: '#' },
      { label: 'Контакты', href: '#' },
    ],
  },
  {
    title: 'Поддержка',
    links: [
      { label: 'FAQ', href: '#' },
      { label: 'Документация', href: '#' },
      { label: 'Связаться с нами', href: '#' },
      { label: 'Статус системы', href: '#' },
    ],
  },
  {
    title: 'Правовая информация',
    links: [
      { label: 'Публичная оферта', href: `${LEGAL_BASE}/legal/oferta` },
      { label: 'Политика конфиденциальности', href: `${LEGAL_BASE}/legal/privacy` },
      { label: 'Реквизиты', href: `${LEGAL_BASE}/legal` },
    ],
  },
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

      {cols.map((col) => (
        <div key={col.title}>
          <h4>{col.title}</h4>
          {col.links.map((link) => (
            <a href={link.href} key={link.label}>
              {link.label}
            </a>
          ))}
        </div>
      ))}
    </footer>
  )
}
