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
    text: 'Следите за отзывами, упоминаниями и рейтингами на всех ключевых площадках.',
    icon: Activity,
  },
  {
    title: 'Аналитика и отчёты',
    text: 'Понятные дашборды и отчёты помогают видеть динамику целиком.',
    icon: BarChart3,
  },
  {
    title: 'ИИ-аналитика и оповещения',
    text: 'Искусственный интеллект выделяет риски и важные изменения.',
    icon: BellRing,
  },
  {
    title: 'Единая лента реакции',
    text: 'Отзывы и сообщения из всех источников в одном окне.',
    icon: Inbox,
  },
  {
    title: 'Рост рейтинга',
    text: 'Работайте с обратной связью и усиливайте репутацию.',
    icon: TrendingUp,
  },
  {
    title: 'Безопасность данных',
    text: 'Данные защищены на уровне enterprise: шифрование, бэкапы и контроль доступа.',
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
          Вселенная вашей репутации — <span className="text-cyan-300">под контролем</span>
        </h2>

        <p className="mx-auto mt-7 max-w-4xl text-xl leading-9 text-slate-300">
          Все инструменты для контроля, анализа и роста вашей репутации в одном пространстве.
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
