import { Check, Sparkles } from 'lucide-react'
import ButtonLink from './ui/ButtonLink'
import Container from './ui/Container'
import Section from './ui/Section'

const plans = [
  {
    name: 'Старт',
    price: '990 ₽',
    period: '/мес',
    subtitle: 'Для первой компании или одной точки',
    badge: null,
    accent: 'from-cyan-300/12 via-slate-950/70 to-slate-950/80 border-cyan-200/25',
    button: 'Написать',
    href: 'https://t.me/max92pole',
    features: [
      'Одна компания или точка',
      'Базовый мониторинг отзывов',
      'Ручной запуск сбора',
      'Единый Inbox для сигналов'
    ],
    note: 'Хороший вариант, чтобы быстро начать контроль репутации без сложного внедрения.'
  },
  {
    name: 'Бизнес',
    price: '1 990 ₽',
    period: '/мес',
    subtitle: 'Для регулярного мониторинга и нескольких источников',
    badge: 'Рекомендуемый',
    accent: 'from-violet-400/18 via-slate-950/75 to-cyan-950/30 border-cyan-200/45',
    button: 'Обсудить',
    href: 'https://t.me/max92pole',
    features: [
      'Несколько источников мониторинга',
      'Регулярный сбор отзывов и упоминаний',
      'Статусы синхронизации',
      'WEB-источники и внешние страницы'
    ],
    note: 'Оптимальный тариф для бизнеса, которому важно видеть отзывы, рейтинги и упоминания в одном месте.'
  },
  {
    name: 'Сеть',
    price: '2 990 ₽',
    period: '/мес',
    subtitle: 'Для нескольких компаний, филиалов или городов',
    badge: 'Для роста',
    accent: 'from-blue-400/14 via-slate-950/75 to-slate-950/85 border-blue-200/35',
    button: 'Запросить внедрение',
    href: 'https://t.me/max92pole',
    features: [
      'Несколько компаний и филиалов',
      'Приоритетные источники',
      'Расширенная логика мониторинга',
      'Доработка под рабочий процесс'
    ],
    note: 'Подходит для сетевых компаний, где репутация распределена по нескольким точкам и площадкам.'
  }
]

export default function PricingSection() {
  return (
    <Section id="pricing" ariaLabel="Тарифы Reputation OS">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Тарифы
          </p>
          <h2 className="mt-3 text-[38px] font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Запуск без лишней сложности
          </h2>
          <p className="mt-4 text-[17px] leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Начните с базового мониторинга, а затем подключайте больше источников, компаний и сценариев сбора.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:mt-10 sm:gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={[
                'relative overflow-hidden rounded-[1.5rem] border bg-gradient-to-br p-5 sm:rounded-[1.75rem] shadow-2xl shadow-cyan-950/20 sm:p-6',
                'transition duration-300 hover:-translate-y-1 hover:border-cyan-200/60 hover:shadow-cyan-500/10',
                plan.accent
              ].join(' ')}
            >
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
              <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
              <div className="absolute -bottom-28 left-8 h-44 w-44 rounded-full bg-violet-400/10 blur-3xl" />

              <div className="relative flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {plan.badge ? (
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                        <Sparkles size={14} />
                        {plan.badge}
                      </div>
                    ) : (
                      <div className="mb-3 h-6" />
                    )}

                    <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {plan.name}
                    </h3>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-right shadow-lg shadow-black/20">
                    <div className="whitespace-nowrap text-xl font-semibold text-cyan-50">
                      {plan.price}
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-slate-400">
                      {plan.period}
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-[15px] leading-6 text-slate-300 sm:text-base sm:leading-7">
                  {plan.subtitle}
                </p>
              </div>

              <div className="relative mt-5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              <ul className="relative mt-5 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-[15px] leading-6 text-slate-100 sm:leading-7">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200">
                      <Check size={16} />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <ButtonLink
                href={plan.href}
                external
                className="relative mt-6 w-full justify-center"
              >
                {plan.button}
              </ButtonLink>

              <p className="relative mt-4 text-sm leading-6 text-slate-400 sm:text-[15px] sm:leading-7">
                {plan.note}
              </p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-7 max-w-3xl text-center text-sm leading-7 text-slate-500">
          Финальные условия зависят от количества компаний, источников, частоты сбора и нужных доработок.
        </p>
      </Container>
    </Section>
  )
}
