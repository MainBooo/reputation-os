import {
  BookOpenText,
  FileText,
  Info,
  MapPinned,
  Search,
  SlidersHorizontal,
  Star
} from 'lucide-react'

const sources = [
  {
    title: 'Карты и геосервисы',
    description: 'Отзывы, рейтинг и карточки компании.',
    icon: MapPinned
  },
  {
    title: 'Каталоги и справочники',
    description: 'Площадки со структурированной карточкой бизнеса.',
    icon: BookOpenText
  },
  {
    title: 'Сайты с отзывами',
    description: 'Оценки, тональность и новые отзывы.',
    icon: Star
  },
  {
    title: 'Статьи и web-страницы',
    description: 'Публикации и внешние упоминания компании.',
    icon: FileText
  },
  {
    title: 'Поисковая выдача',
    description: 'Результаты, которые могут влиять на доверие.',
    icon: Search
  },
  {
    title: 'Пользовательские источники',
    description: 'Свои ссылки и сценарии отслеживания.',
    icon: SlidersHorizontal
  }
]

export default function SourcesSection() {
  return (
    <section className="border-b border-white/10">
      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-12 sm:px-6 sm:py-16 md:px-8 md:py-24 lg:grid-cols-[1fr_0.92fr]">
        <div>
          <h2 className="max-w-3xl text-[34px] font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Карта источников: где бизнес уже обсуждают
          </h2>

          <p className="mt-4 max-w-2xl text-[17px] leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Reputation OS помогает собрать площадки, где появляются отзывы, рейтинг, статьи и внешние сигналы, чтобы команда видела не только отдельные оценки, но и общую картину репутации.
          </p>

          <div className="mt-4 flex max-w-2xl gap-3 rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.05] p-4 text-sm leading-6 text-slate-300">
            <Info className="mt-0.5 shrink-0 text-cyan-200" size={18} />
            <p>
              Набор источников зависит от настроек проекта и доступности данных. Лендинг не заявляет официальное партнёрство с площадками.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {sources.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.title}
                  className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 sm:h-12 sm:w-12">
                    <Icon className="h-6 w-6" />
                  </div>

                  <h3 className="text-lg font-semibold text-white sm:text-xl">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-300 md:text-base md:leading-7">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-slate-950/60 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-6">
          <div className="rounded-[22px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(16,30,55,0.95)_0%,rgba(7,14,28,0.98)_100%)] p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              <h3 className="text-lg font-semibold text-white sm:text-xl">
                Как это выглядит в платформе
              </h3>

              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-medium text-slate-200">
                Сеть
              </span>
            </div>

            <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-medium text-cyan-300">
                  Найденные источники
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300 sm:leading-7">
                  Система собирает релевантные страницы, статьи, каталоги и карточки, чтобы команда видела не только отзывы, но и общий контекст вокруг компании.
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-sm font-medium text-white">
                    Web-источники
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-cyan-300">
                    12+
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Страницы, статьи и внешние упоминания
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-sm font-medium text-white">
                    Подключаемые площадки
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-cyan-300">
                    6
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Карты, каталоги, review-сайты и свои ссылки
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-cyan-400/20 bg-cyan-400/[0.04] p-4 text-sm leading-7 text-slate-300">
                Раздел «Сеть» показывает, где вокруг компании появляются внешние сигналы: от отзывов до страниц, которые могут влиять на доверие.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
