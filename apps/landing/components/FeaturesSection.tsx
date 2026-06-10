import {
  Activity,
  BarChart3,
  BellRing,
  Inbox,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'

const features = [
  {
    title: 'Мониторинг 24/7',
    text: 'Система автоматически собирает отзывы с Яндекс Карт, 2ГИС и web-источников. Вы узнаёте о новом сигнале раньше, чем он становится проблемой.',
    icon: Activity,
  },
  {
    title: 'Аналитика и отчёты',
    text: 'Средний рейтинг, тренд упоминаний, тональность — всё в одном дашборде. Скачайте отчёт в один клик для клиента или презентации.',
    icon: BarChart3,
  },
  {
    title: 'AI пишет ответы — вы отправляете',
    text: 'Встроенный AI генерирует ответ на каждый отзыв с учётом тональности. Экономит время команды и снижает риск эмоциональных ответов на негатив.',
    icon: BellRing,
  },
  {
    title: 'Единый Inbox',
    text: 'Все отзывы и упоминания из всех источников в одной ленте. Фильтр по тональности, источнику и дате — ни один сигнал не потеряется.',
    icon: Inbox,
  },
  {
    title: 'Рост рейтинга',
    text: 'Отвечайте на отзывы вовремя — и рейтинг растёт. Система показывает, где внимание нужно в первую очередь.',
    icon: TrendingUp,
  },
  {
    title: 'Командная работа',
    text: 'Workspace под каждого клиента или бренд. Роли Owner, Admin, Member — каждый видит только то, что нужно для работы.',
    icon: ShieldCheck,
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="relative z-10 mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl text-center">
        <span className="mb-7 block text-lg font-semibold uppercase tracking-[0.42em] text-cyan-300 sm:text-xl">
          Возможности
        </span>

        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
          Всё для управления репутацией — <span className="text-cyan-300">в одном месте</span>
        </h2>

        <p className="mx-auto mt-7 max-w-4xl text-xl leading-9 text-slate-300">
          Мониторинг, AI-ответы, аналитика и командная работа — без переключения между сервисами.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 py-12 sm:grid-cols-2 lg:grid-cols-2">
        {features.map(({ title, text, icon: Icon }) => (
          <article
            className="group relative min-h-12 overflow-hidden rounded-[28px] border border-cyan-200/15 bg-white/[0.04] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] transition duration-300 hover:border-cyan-300/35 hover:bg-cyan-300/[0.06]"
            key={title}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-cyan-300/[0.08] blur-3xl transition duration-700 group-hover:bg-cyan-300/[0.16]" />

            <div className="relative z-10 mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200 shadow-[0_0_34px_rgba(34,211,238,0.18)]">
              <Icon size={28} strokeWidth={1.9} />
            </div>

            <h3 className="relative z-10 text-xl font-semibold tracking-tight text-white">
              {title}
            </h3>

            <p className="relative z-10 mt-4 text-[15px] leading-7 text-slate-300">
              {text}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
