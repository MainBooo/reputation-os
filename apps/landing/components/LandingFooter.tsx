import Container from './ui/Container'

const links = [
  { href: '#features', label: 'Возможности' },
  { href: '#pricing', label: 'Тарифы' },
  { href: '#faq', label: 'FAQ' },
  { href: 'https://reputation.generationweb.ru/login', label: 'Войти в платформу' }
]

export default function LandingFooter() {
  return (
    <footer className="border-t border-white/10 py-10">
      <Container className="grid gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <div className="text-lg font-semibold text-white">Reputation OS</div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            Единый Inbox для отзывов, упоминаний, источников и сигналов репутации бизнеса.
          </p>
          <div className="mt-4 space-y-1 text-sm text-slate-400">
            <p>generationweb.ru</p>
            <a href="https://t.me/max92pole" target="_blank" rel="noopener noreferrer" className="inline-flex text-cyan-200 hover:text-cyan-100">
              Telegram @max92pole
            </a>
          </div>
        </div>

        <nav aria-label="Навигация в подвале" className="flex flex-wrap gap-4 md:justify-end">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-slate-400 transition hover:text-cyan-200">
              {link.label}
            </a>
          ))}
        </nav>
      </Container>
    </footer>
  )
}
