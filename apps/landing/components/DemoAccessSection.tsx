export default function DemoAccessSection() {
  return (
    <section id="demo" className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[28px] border border-cyan-200/15 bg-white/[0.04] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.08] blur-3xl" />

        <div className="relative z-10 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="mb-5 block text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">
              Демо-доступ
            </span>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              Посмотрите живой продукт — без регистрации
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              Войдите в демо-аккаунт и оцените дашборд, Inbox отзывов, аналитику
              и AI-ответы на реальных данных. Это работающая система, а не презентация.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-200/20 bg-[#0b1024]/80 p-6 sm:p-8">
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Логин
                </span>
                <code className="mt-2 block rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 font-mono text-[15px] text-cyan-200">
                  demo@reputation.local
                </code>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Пароль
                </span>
                <code className="mt-2 block rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 font-mono text-[15px] text-cyan-200">
                  demo123
                </code>
              </div>
            </div>
            <a
              className="btn btn-gradient mt-7 inline-flex"
              href="https://reputation.generationweb.ru/login"
            >
              Открыть демо →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
