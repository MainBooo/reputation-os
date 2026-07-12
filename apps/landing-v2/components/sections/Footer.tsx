const LEGAL_BASE = 'https://reputation.generationweb.ru';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-10 text-paper">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <span className="font-display text-sm font-bold">
          Reputation<span className="opacity-60">OS</span>
        </span>
        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 font-mono text-xs text-paper/50">
          <a className="transition-colors hover:text-paper" href={`${LEGAL_BASE}/legal/oferta`}>
            Публичная оферта
          </a>
          <a className="transition-colors hover:text-paper" href={`${LEGAL_BASE}/legal/privacy`}>
            Политика конфиденциальности
          </a>
          <a className="transition-colors hover:text-paper" href={`${LEGAL_BASE}/legal`}>
            Реквизиты
          </a>
        </nav>
        <span className="font-mono text-xs text-paper/30">© {new Date().getFullYear()} ReputationOS</span>
      </div>
    </footer>
  );
}
