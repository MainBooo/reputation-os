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
    <section className="section">
      <div className="section-title">
        <span>Возможности</span>

        <h2>
          Вселенная вашей репутации — <span>под контролем</span>
        </h2>

        <p>
          Все инструменты для контроля, анализа и роста вашей
          репутации в одном пространстве.
        </p>
      </div>

      <div className="features">
        {features.map(({ title, text, icon: Icon }) => (
          <article className="feature-card" key={title}>
            <div className="feature-icon">
              <Icon size={28} strokeWidth={1.9} />
            </div>

            <h3>{title}</h3>

            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
