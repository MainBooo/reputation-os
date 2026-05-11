import { Activity, BellRing, Globe2, Inbox } from 'lucide-react'
import { ScreenshotFrame } from './ScreenshotFrame'

const items = [
  {
    title: 'Inbox отзывов и упоминаний',
    description: 'Единая лента сигналов по компании.',
    icon: Inbox
  },
  {
    title: 'Сеть: web-источники',
    description: 'Найденные страницы, статьи и внешние источники.',
    icon: Globe2
  },
  {
    title: 'Рейтинги и динамика',
    description: 'Понятная картина изменений по репутации.',
    icon: Activity
  },
  {
    title: 'Оповещения о рисках',
    description: 'Новые негативные сигналы не теряются между площадками.',
    icon: BellRing
  }
]

export default function ProductPreviewSection() {
  return (
    <section className="border-b border-white/10">
      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-12 sm:px-6 sm:py-16 md:px-8 md:py-24 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <h2 className="max-w-3xl text-[34px] font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Reputation OS собирает всё в единую ленту реакции
          </h2>

          <p className="mt-4 max-w-2xl text-[17px] leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Отзывы, рейтинги, web-упоминания, источники и оповещения попадают в один рабочий центр — чтобы команда быстрее понимала, где появился риск и что требует ответа.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {items.map((item) => {
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

        <div className="space-y-5">
          <ScreenshotFrame
            src="/screenshots/platform-dashboard-analytics.jpeg"
            alt="Аналитика Reputation OS"
            label="Аналитика"
            caption="Аналитический экран помогает видеть динамику упоминаний, тональность, распределение источников и изменения рейтинга без лишнего визуального шума."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-slate-400">Что видно</div>
              <div className="mt-2 text-lg font-semibold text-white">
                Тональность
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Позитив, нейтральные и негативные сигналы по компании.
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-slate-400">Что видно</div>
              <div className="mt-2 text-lg font-semibold text-white">
                Динамика
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Рост упоминаний и изменение репутационных показателей.
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-slate-400">Что видно</div>
              <div className="mt-2 text-lg font-semibold text-white">
                Источники
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Где именно появляются отзывы, статьи и внешние сигналы.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
