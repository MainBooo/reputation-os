export default function DemoAccessSection() {
  return (
    <section id="demo" className="relative z-10 mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-24">
      <div className="relative overflow-hidden rounded-[28px] border border-cyan-200/15 bg-white/[0.04] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-300/[0.08] blur-3xl" />

        <div className="relative z-10 grid items-center gap-7 lg:grid-cols-2">
          <div>
            <span className="mb-5 block text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">
              Демо-доступ
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Посмотрите живой продукт — без регистрации
            </h2>
            <p className="mt-5 max-w-2xl text-lg text-slate-300 sm:leading-8">
              Войдите в демо-аккаунт и оцените дашборд, Inbox отзывов, аналитику
              и AI-ответы на реальных данных. Это работающая система, а не презентация.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-200/20 bg-slate-950/70 p-5 sm:p-6">
            <div className="space-y-5">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                  Логин
                </span>
                <code className="mt-2 block rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[15px] text-cyan-200">
                  demo@reputation.local
                </code>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                  Пароль
                </span>
                <code className="mt-2 block rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[15px] text-cyan-200">
                  demo123
                </code>
              </div>
            </div>
            <a
              className="btn btn-gradient mt-8 inline-flex"
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
