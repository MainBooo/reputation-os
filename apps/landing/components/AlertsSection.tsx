import { AlertTriangle, BellRing, Globe2, Star } from 'lucide-react'
import Card from './ui/Card'
import Container from './ui/Container'
import Section from './ui/Section'

const alertCards = [
  {
    icon: BellRing,
    title: 'Новый отзыв',
    text: 'Команда видит свежие отзывы без ручного обхода площадок.'
  },
  {
    icon: Star,
    title: 'Падение рейтинга',
    text: 'Система помогает заметить снижение оценки по компании или точке.'
  },
  {
    icon: Globe2,
    title: 'Новый web-сигнал',
    text: 'Внешние страницы и упоминания не теряются в общей сети.'
  }
]

export default function AlertsSection() {
  return (
    <Section ariaLabel="Оповещения Reputation OS" className="border-y border-white/10 bg-cyan-300/[0.02]">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Оповещения
          </p>
          <h2 className="mt-3 text-[34px] font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Оповещения, чтобы не пропустить репутационный риск
          </h2>
          <p className="mt-4 text-[17px] leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Платформа помогает команде быстрее заметить новый негативный отзыв, падение рейтинга или важное web-упоминание — без ручной проверки каждой площадки.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-200/20 bg-slate-950/70 p-4 shadow-2xl shadow-cyan-950/25 sm:p-6">
            <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-blue-400/10 blur-3xl" />

            <div className="relative rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-semibold text-cyan-100">
                  <BellRing size={15} />
                  Новое оповещение
                </div>
                <span className="rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-100">
                  Требует внимания
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-400/10 text-red-200">
                    <AlertTriangle size={22} />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-white">
                      Негативный отзыв
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Яндекс Карты · 2 минуты назад
                    </p>
                    <div className="mt-3 inline-flex rounded-full border border-cyan-200/15 bg-cyan-300/[0.06] px-3 py-1 text-sm font-medium text-cyan-100">
                      Оценка: 2.0 ★
                    </div>
                    <p className="mt-4 text-[15px] leading-7 text-slate-300">
                      Клиент жалуется на долгое ожидание
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-4 rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.05] px-4 py-3 text-sm leading-6 text-slate-300">
                Reputation OS добавила сигнал в Inbox и подсветила источник.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {alertCards.map((item) => {
              const Icon = item.icon

              return (
                <Card key={item.title} className="rounded-[1.5rem]">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                    <Icon size={22} />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
                </Card>
              )
            })}
          </div>
        </div>
      </Container>
    </Section>
  )
}
